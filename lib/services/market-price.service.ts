import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { marketPrices, metals } from "../db/schema";
import { D, toDb } from "../decimal";
import { NotFoundError } from "../errors";
import type { MarketPriceCreateInput, MetalCode } from "../validation";

export async function recordMarketPrice(input: MarketPriceCreateInput) {
  const metal = await db.select().from(metals).where(eq(metals.code, input.metalCode)).get();
  if (!metal) throw new NotFoundError("Metal", input.metalCode);

  const effectiveAt = input.effectiveAt ? new Date(input.effectiveAt) : new Date();
  const [created] = await db
    .insert(marketPrices)
    .values({
      metalId: metal.id,
      pricePerKg: toDb(input.pricePerKg),
      currency: input.currency ?? "USD",
      effectiveAt,
      source: "manual",
    })
    .returning();
  return { ...created, metal };
}

export async function getCurrentPrices() {
  // Latest price per metal: subquery picks the max(effective_at) per metal_id, then we join.
  const latest = db
    .select({
      metalId: marketPrices.metalId,
      maxEffective: sql<number>`MAX(${marketPrices.effectiveAt})`.as("max_effective"),
    })
    .from(marketPrices)
    .groupBy(marketPrices.metalId)
    .as("latest");

  return db
    .select({
      metalId: metals.id,
      metalCode: metals.code,
      metalName: metals.name,
      pricePerKg: marketPrices.pricePerKg,
      currency: marketPrices.currency,
      effectiveAt: marketPrices.effectiveAt,
    })
    .from(metals)
    .leftJoin(latest, eq(latest.metalId, metals.id))
    .leftJoin(
      marketPrices,
      sql`${marketPrices.metalId} = ${metals.id} AND ${marketPrices.effectiveAt} = ${latest.maxEffective}`,
    )
    .all();
}

export async function getPriceForMetal(metalId: number): Promise<string | null> {
  const row = await db
    .select({ pricePerKg: marketPrices.pricePerKg })
    .from(marketPrices)
    .where(eq(marketPrices.metalId, metalId))
    .orderBy(desc(marketPrices.effectiveAt))
    .limit(1)
    .get();
  return row?.pricePerKg ?? null;
}

export async function getPriceForCode(code: MetalCode): Promise<string | null> {
  const metal = await db.select().from(metals).where(eq(metals.code, code)).get();
  if (!metal) return null;
  return getPriceForMetal(metal.id);
}

export async function listPriceHistory(metalCode: MetalCode, limit = 50) {
  const metal = await db.select().from(metals).where(eq(metals.code, metalCode)).get();
  if (!metal) throw new NotFoundError("Metal", metalCode);
  return db
    .select()
    .from(marketPrices)
    .where(eq(marketPrices.metalId, metal.id))
    .orderBy(desc(marketPrices.effectiveAt))
    .limit(limit)
    .all();
}

/** Multiply quantity (string decimal) by price (string decimal); both kept lossless. */
export function valueAt(quantityKg: string, pricePerKg: string | null): string | null {
  if (pricePerKg === null) return null;
  return D(quantityKg).times(D(pricePerKg)).toFixed(2);
}

export type PriceSnapshot = {
  metalId: number;
  metalCode: string;
  metalName: string;
  pricePerKg: string | null;
  effectiveAt: Date | null;
  previousPricePerKg: string | null;
  /** Numeric trend ordered ASC by effective_at — for sparkline rendering. */
  trend: number[];
};

/**
 * Per-metal recent price snapshots: latest price, previous price (for delta),
 * and a numeric trend window for charting. One row per metal, including metals
 * with no recorded price (returned as nulls / empty trend).
 */
export async function getPriceSnapshots(window = 12): Promise<PriceSnapshot[]> {
  const allMetals = await db.select().from(metals).orderBy(metals.code).all();
  return Promise.all(
    allMetals.map(async (m) => {
      const rows = await db
        .select({ pricePerKg: marketPrices.pricePerKg, effectiveAt: marketPrices.effectiveAt })
        .from(marketPrices)
        .where(eq(marketPrices.metalId, m.id))
        .orderBy(desc(marketPrices.effectiveAt))
        .limit(window)
        .all();
      const latest = rows[0] ?? null;
      const previous = rows[1] ?? null;
      return {
        metalId: m.id,
        metalCode: m.code,
        metalName: m.name,
        pricePerKg: latest?.pricePerKg ?? null,
        effectiveAt: latest?.effectiveAt ?? null,
        previousPricePerKg: previous?.pricePerKg ?? null,
        trend: rows
          .slice()
          .reverse()
          .map((r) => Number(r.pricePerKg)),
      };
    }),
  );
}
