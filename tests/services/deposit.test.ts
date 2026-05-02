import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bars, transactions, unallocatedHoldings, metals } from "@/lib/db/schema";
import { recordDeposit } from "@/lib/services/deposit.service";
import { createCustomerAndAccount, resetDb } from "../helpers/db";

describe("recordDeposit", () => {
  let vaultId: number;

  beforeEach(async () => {
    const seeded = await resetDb();
    vaultId = seeded.vaults[0].id;
  });

  it("unallocated: increases the holding and writes a ledger row", async () => {
    const { account } = await createCustomerAndAccount();

    const result = await recordDeposit({
      storageType: "unallocated",
      accountId: account.id,
      metalCode: "XAU",
      vaultId,
      quantityKg: "10.5",
    });

    const xau = await db.select().from(metals).where(eq(metals.code, "XAU")).get();
    const holding = await db
      .select()
      .from(unallocatedHoldings)
      .where(
        and(eq(unallocatedHoldings.accountId, account.id), eq(unallocatedHoldings.metalId, xau!.id)),
      )
      .get();

    expect(holding?.quantityKg).toBe("10.50000000");

    const ledger = await db
      .select()
      .from(transactions)
      .where(eq(transactions.accountId, account.id))
      .all();
    expect(ledger).toHaveLength(1);
    expect(ledger[0].type).toBe("deposit");
    expect(ledger[0].storageType).toBe("unallocated");
    expect(ledger[0].quantityKg).toBe("10.50000000");
    expect(ledger[0].barId).toBeNull();
    expect(result.transaction.id).toBe(ledger[0].id);
  });

  it("allocated: creates the bar in_custody and writes a ledger row", async () => {
    const { account } = await createCustomerAndAccount();

    await recordDeposit({
      storageType: "allocated",
      accountId: account.id,
      metalCode: "XAU",
      vaultId,
      bar: { serialNumber: "AU-2026-00001", weightKg: "12.4567", purity: "0.9999" },
    });

    const bar = await db
      .select()
      .from(bars)
      .where(eq(bars.serialNumber, "AU-2026-00001"))
      .get();
    expect(bar).toBeDefined();
    expect(bar?.status).toBe("in_custody");
    expect(bar?.currentAccountId).toBe(account.id);
    expect(bar?.weightKg).toBe("12.45670000");

    const ledger = await db
      .select()
      .from(transactions)
      .where(eq(transactions.accountId, account.id))
      .all();
    expect(ledger).toHaveLength(1);
    expect(ledger[0].storageType).toBe("allocated");
    expect(ledger[0].barId).toBe(bar?.id);
  });
});
