import { db } from "../db/client";
import { metals } from "../db/schema";
import { D } from "../decimal";
import { getCurrentPrices } from "./market-price.service";

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
  const [allMetals, currentPrices] = await Promise.all([
    db.select().from(metals).all(),
    getCurrentPrices(),
  ]);
  const idToMetal = new Map(allMetals.map((m) => [m.id, m]));
  const codeToMetal = new Map(allMetals.map((m) => [m.code, m]));
  const priceByMetalId = new Map(currentPrices.map((p) => [p.metalId, p.pricePerKg]));

  const totals = new Map<
    number,
    { quantity: ReturnType<typeof D>; metalCode: string; metalName: string }
  >();

  const accumulate = (metalId: number, qty: string) => {
    const metal = idToMetal.get(metalId);
    if (!metal) return;
    const entry = totals.get(metal.id) ?? {
      quantity: D(0),
      metalCode: metal.code,
      metalName: metal.name,
    };
    entry.quantity = entry.quantity.plus(D(qty));
    totals.set(metal.id, entry);
  };

  for (const h of input.unallocated) accumulate(h.metalId, h.quantityKg);
  for (const b of input.allocated) {
    const metal = codeToMetal.get(b.metalCode);
    if (metal) accumulate(metal.id, b.weightKg);
  }

  const perMetal: Valuation["perMetal"] = [];
  let total = D(0);
  let anyValued = false;

  for (const [metalId, entry] of totals) {
    const price = priceByMetalId.get(metalId) ?? null;
    let valueUSD: string | null = null;
    if (price !== null) {
      valueUSD = entry.quantity.times(D(price)).toFixed(2);
      total = total.plus(D(valueUSD));
      anyValued = true;
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
    totalUSD: anyValued ? total.toFixed(2) : null,
    asOf: new Date(),
    perMetal,
  };
}
