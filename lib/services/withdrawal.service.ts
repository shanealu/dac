import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import {
  accounts,
  bars,
  metals,
  transactions,
  unallocatedHoldings,
} from "../db/schema";
import { D, toDb } from "../decimal";
import {
  BarAlreadyWithdrawnError,
  BarOwnershipError,
  InsufficientBalanceError,
  NotFoundError,
} from "../errors";
import { getPriceForMetal } from "./market-price.service";
import { nextReference } from "./reference";
import type { WithdrawalInput } from "../validation";

export async function recordWithdrawal(input: WithdrawalInput) {
  const account = await db.select().from(accounts).where(eq(accounts.id, input.accountId)).get();
  if (!account) throw new NotFoundError("Account", input.accountId);

  if (input.storageType === "unallocated") {
    const metal = await db.select().from(metals).where(eq(metals.code, input.metalCode)).get();
    if (!metal) throw new NotFoundError("Metal", input.metalCode);
    const priceAtTime = await getPriceForMetal(metal.id);

    return db.transaction((tx) => {
      const holding = tx
        .select()
        .from(unallocatedHoldings)
        .where(
          and(
            eq(unallocatedHoldings.accountId, input.accountId),
            eq(unallocatedHoldings.metalId, metal.id),
          ),
        )
        .get();

      const available = holding ? D(holding.quantityKg) : D(0);
      const requested = D(input.quantityKg);
      if (available.lt(requested)) {
        throw new InsufficientBalanceError(
          input.metalCode,
          requested.toFixed(8),
          available.toFixed(8),
        );
      }

      const newQty = available.minus(requested);
      tx.update(unallocatedHoldings)
        .set({ quantityKg: toDb(newQty), updatedAt: new Date() })
        .where(eq(unallocatedHoldings.id, holding!.id))
        .run();

      const referenceNumber = nextReference(tx, "TXN");
      const [txnRow] = tx
        .insert(transactions)
        .values({
          referenceNumber,
          accountId: input.accountId,
          metalId: metal.id,
          type: "withdrawal",
          storageType: "unallocated",
          quantityKg: toDb(requested),
          vaultId: input.vaultId,
          pricePerKgAtTime: priceAtTime,
          notes: input.notes,
        })
        .returning()
        .all();

      return { transaction: txnRow, holding: { newQuantityKg: toDb(newQty) } };
    });
  }

  // allocated — resolve metal + price up front, then run the transaction
  const preBar = await db.select().from(bars).where(eq(bars.id, input.barId)).get();
  const priceAtTime = preBar ? await getPriceForMetal(preBar.metalId) : null;

  return db.transaction((tx) => {
    const bar = tx.select().from(bars).where(eq(bars.id, input.barId)).get();
    if (!bar) throw new BarOwnershipError(); // also covers genuine "not found"
    // Status check before ownership: once withdrawn, current_account_id is null, so
    // an ownership-first check would mask the real reason (spec §8.2 expects 409 here).
    if (bar.status === "withdrawn") throw new BarAlreadyWithdrawnError(bar.serialNumber);
    if (bar.currentAccountId !== input.accountId) throw new BarOwnershipError();

    tx.update(bars)
      .set({ status: "withdrawn", currentAccountId: null, updatedAt: new Date() })
      .where(eq(bars.id, bar.id))
      .run();

    const referenceNumber = nextReference(tx, "TXN");
    const [txnRow] = tx
      .insert(transactions)
      .values({
        referenceNumber,
        accountId: input.accountId,
        metalId: bar.metalId,
        type: "withdrawal",
        storageType: "allocated",
        quantityKg: bar.weightKg,
        barId: bar.id,
        vaultId: bar.vaultId,
        pricePerKgAtTime: priceAtTime,
        notes: input.notes,
      })
      .returning()
      .all();

    return { transaction: txnRow, bar: { ...bar, status: "withdrawn" as const } };
  });
}
