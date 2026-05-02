import { and, eq, sql } from "drizzle-orm";
import { counters } from "../db/schema";
import type { db as dbClient } from "../db/client";

type Tx = Parameters<Parameters<typeof dbClient.transaction>[0]>[0];

const PAD = 6;

export function nextReference(
  tx: Tx,
  prefix: "ACC" | "TXN",
  year: number = new Date().getFullYear(),
): string {
  const updated = tx
    .update(counters)
    .set({ value: sql`${counters.value} + 1` })
    .where(and(eq(counters.prefix, prefix), eq(counters.year, year)))
    .returning()
    .get();

  let value: number;
  if (updated) {
    value = updated.value;
  } else {
    const inserted = tx.insert(counters).values({ prefix, year, value: 1 }).returning().get();
    value = inserted!.value;
  }

  return `${prefix}-${year}-${String(value).padStart(PAD, "0")}`;
}
