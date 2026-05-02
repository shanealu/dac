import { db } from "../db/client";
import { metals } from "../db/schema";
import { D, ZERO } from "../decimal";
import { getPriceForMetal } from "./market-price.service";

type Holding = { metalId: number; quantityKg: string };
type Bar = { metalCode: string; weightKg: string };

export type Valuation = {
  totalUSD: string | null;
  asOf: Date;
  perMetal: Array<{
    metalCode: string;
    metalName: string;
    quantityKg: string;
    pricePerKg: string | null;
    valueUSD: string | null;
  }>;
};

export async function valuateAccount(input: {
  unallocated: Holding[];
  allocated: Bar[];
}): Promise<Valuation> {
  const allMetals = await db.select().from(metals).all();
  const codeToMetal = new Map(allMetals.map((m) => [m.code, m]));
  const idToMetal = new Map(allMetals.map((m) => [m.id, m]));

  // Aggregate quantity per metal across both storage types
  const totals = new Map<number, { quantity: ReturnType<typeof D>; metalCode: string; metalName: string }>();

  for (const h of input.unallocated) {
    const metal = idToMetal.get(h.metalId);
    if (!metal) continue;
    const entry = totals.get(metal.id) ?? {
      quantity: ZERO.plus(0),
      metalCode: metal.code,
      metalName: metal.name,
    };
    entry.quantity = entry.quantity.plus(D(h.quantityKg));
    totals.set(metal.id, entry);
  }

  for (const b of input.allocated) {
    const metal = codeToMetal.get(b.metalCode);
    if (!metal) continue;
    const entry = totals.get(metal.id) ?? {
      quantity: ZERO.plus(0),
      metalCode: metal.code,
      metalName: metal.name,
    };
    entry.quantity = entry.quantity.plus(D(b.weightKg));
    totals.set(metal.id, entry);
  }

  const perMetal: Valuation["perMetal"] = [];
  let total = ZERO.plus(0);
  let anyUnpriced = false;
  let anyValued = false;

  for (const [metalId, entry] of totals) {
    const price = await getPriceForMetal(metalId);
    let valueUSD: string | null = null;
    if (price !== null) {
      valueUSD = entry.quantity.times(D(price)).toFixed(2);
      total = total.plus(D(valueUSD));
      anyValued = true;
    } else {
      anyUnpriced = true;
    }
    perMetal.push({
      metalCode: entry.metalCode,
      metalName: entry.metalName,
      quantityKg: entry.quantity.toFixed(8),
      pricePerKg: price,
      valueUSD,
    });
  }

  perMetal.sort((a, b) => a.metalCode.localeCompare(b.metalCode));

  return {
    // If every metal lacks a price, valuation is null. Mixed: sum of priced metals (UI explains).
    totalUSD: anyValued ? total.toFixed(2) : null,
    asOf: new Date(),
    perMetal: perMetal.map((m) => ({ ...m })),
    ...(anyUnpriced ? {} : {}),
  };
}
