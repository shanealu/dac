import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bars } from "@/lib/db/schema";
import { recordDeposit } from "@/lib/services/deposit.service";
import { recordWithdrawal } from "@/lib/services/withdrawal.service";
import {
  BarAlreadyWithdrawnError,
  BarOwnershipError,
  InsufficientBalanceError,
} from "@/lib/errors";
import { createCustomerAndAccount, resetDb } from "../helpers/db";

describe("recordWithdrawal", () => {
  let vaultId: number;

  beforeEach(async () => {
    const seeded = await resetDb();
    vaultId = seeded.vaults[0].id;
  });

  it("unallocated: throws InsufficientBalanceError when requesting more than the holding", async () => {
    const { account } = await createCustomerAndAccount();
    await recordDeposit({
      storageType: "unallocated",
      accountId: account.id,
      metalCode: "XAU",
      vaultId,
      quantityKg: "6",
    });

    await expect(
      recordWithdrawal({
        storageType: "unallocated",
        accountId: account.id,
        metalCode: "XAU",
        vaultId,
        quantityKg: "10",
      }),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
  });

  it("allocated: throws BarOwnershipError for a bar owned by a different account", async () => {
    const owner = await createCustomerAndAccount();
    const intruder = await createCustomerAndAccount();

    await recordDeposit({
      storageType: "allocated",
      accountId: owner.account.id,
      metalCode: "XAU",
      vaultId,
      bar: { serialNumber: "AU-OWN-001", weightKg: "1", purity: "0.9999" },
    });

    const bar = await db.select().from(bars).where(eq(bars.serialNumber, "AU-OWN-001")).get();

    await expect(
      recordWithdrawal({
        storageType: "allocated",
        accountId: intruder.account.id,
        barId: bar!.id,
      }),
    ).rejects.toBeInstanceOf(BarOwnershipError);

    // Bar should still be in custody, untouched
    const after = await db.select().from(bars).where(eq(bars.id, bar!.id)).get();
    expect(after?.status).toBe("in_custody");
    expect(after?.currentAccountId).toBe(owner.account.id);
  });

  it("allocated: concurrent withdrawals of the same bar — exactly one succeeds", async () => {
    const { account } = await createCustomerAndAccount();
    await recordDeposit({
      storageType: "allocated",
      accountId: account.id,
      metalCode: "XAU",
      vaultId,
      bar: { serialNumber: "AU-RACE-001", weightKg: "1", purity: "0.9999" },
    });
    const bar = await db.select().from(bars).where(eq(bars.serialNumber, "AU-RACE-001")).get();

    const results = await Promise.allSettled([
      recordWithdrawal({ storageType: "allocated", accountId: account.id, barId: bar!.id }),
      recordWithdrawal({ storageType: "allocated", accountId: account.id, barId: bar!.id }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      BarAlreadyWithdrawnError,
    );

    const after = await db.select().from(bars).where(eq(bars.id, bar!.id)).get();
    expect(after?.status).toBe("withdrawn");
    expect(after?.currentAccountId).toBeNull();
  });
});
