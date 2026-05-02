import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import {
  accounts,
  bars,
  metals,
  transactions,
  unallocatedHoldings,
  vaults,
} from "../db/schema";
import { D, toDb } from "../decimal";
import { DuplicateSerialError, NotFoundError } from "../errors";
import { getPriceForMetal } from "./market-price.service";
import { nextReference } from "./reference";
import type { DepositInput } from "../validation";

export async function recordDeposit(input: DepositInput) {
  const account = await db.select().from(accounts).where(eq(accounts.id, input.accountId)).get();
  if (!account) throw new NotFoundError("Account", input.accountId);

  const metal = await db.select().from(metals).where(eq(metals.code, input.metalCode)).get();
  if (!metal) throw new NotFoundError("Metal", input.metalCode);

  const vault = await db.select().from(vaults).where(eq(vaults.id, input.vaultId)).get();
  if (!vault) throw new NotFoundError("Vault", String(input.vaultId));

  const priceAtTime = await getPriceForMetal(metal.id);

  if (input.storageType === "unallocated") {
    return db.transaction((tx) => {
      const existing = tx
        .select()
        .from(unallocatedHoldings)
        .where(
          and(
            eq(unallocatedHoldings.accountId, input.accountId),
            eq(unallocatedHoldings.metalId, metal.id),
          ),
        )
        .get();

      const newQty = (existing ? D(existing.quantityKg) : D(0)).plus(D(input.quantityKg));

      if (existing) {
        tx.update(unallocatedHoldings)
          .set({ quantityKg: toDb(newQty), updatedAt: new Date() })
          .where(eq(unallocatedHoldings.id, existing.id))
          .run();
      } else {
        tx.insert(unallocatedHoldings)
          .values({
            accountId: input.accountId,
            metalId: metal.id,
            quantityKg: toDb(newQty),
          })
          .run();
      }

      const referenceNumber = nextReference(tx, "TXN");
      const [txnRow] = tx
        .insert(transactions)
        .values({
          referenceNumber,
          accountId: input.accountId,
          metalId: metal.id,
          type: "deposit",
          storageType: "unallocated",
          quantityKg: toDb(input.quantityKg),
          vaultId: input.vaultId,
          pricePerKgAtTime: priceAtTime,
          notes: input.notes,
        })
        .returning()
        .all();

      return { transaction: txnRow, holding: { newQuantityKg: toDb(newQty) } };
    });
  }

  // allocated
  return db.transaction((tx) => {
    let bar;
    try {
      [bar] = tx
        .insert(bars)
        .values({
          serialNumber: input.bar.serialNumber,
          metalId: metal.id,
          weightKg: toDb(input.bar.weightKg),
          purity: D(input.bar.purity).toFixed(4),
          vaultId: input.vaultId,
          currentAccountId: input.accountId,
          status: "in_custody",
        })
        .returning()
        .all();
    } catch (err) {
      if (err instanceof Error && /UNIQUE.*serial_number/i.test(err.message)) {
        throw new DuplicateSerialError(input.bar.serialNumber);
      }
      throw err;
    }

    const referenceNumber = nextReference(tx, "TXN");
    const [txnRow] = tx
      .insert(transactions)
      .values({
        referenceNumber,
        accountId: input.accountId,
        metalId: metal.id,
        type: "deposit",
        storageType: "allocated",
        quantityKg: toDb(input.bar.weightKg),
        barId: bar!.id,
        vaultId: input.vaultId,
        pricePerKgAtTime: priceAtTime,
        notes: input.notes,
      })
      .returning()
      .all();

    return { transaction: txnRow, bar };
  });
}
