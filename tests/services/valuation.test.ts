import { beforeEach, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { metals, unallocatedHoldings } from "@/lib/db/schema";
import { D } from "@/lib/decimal";
import { recordDeposit } from "@/lib/services/deposit.service";
import { recordMarketPrice } from "@/lib/services/market-price.service";
import { valuateAccount } from "@/lib/services/valuation.service";
import { createCustomerAndAccount, resetDb } from "../helpers/db";

describe("valuation", () => {
  let vaultId: number;

  beforeEach(async () => {
    const seeded = await resetDb();
    vaultId = seeded.vaults[0].id;
  });

  it("derives pool share at read time across three customers", async () => {
    const a = await createCustomerAndAccount();
    const b = await createCustomerAndAccount();
    const c = await createCustomerAndAccount();

    for (const [acc, qty] of [
      [a.account, "10"],
      [b.account, "5"],
      [c.account, "5"],
    ] as const) {
      await recordDeposit({
        storageType: "unallocated",
        accountId: acc.id,
        metalCode: "XAU",
        vaultId,
        quantityKg: qty,
      });
    }

    const xau = await db.select().from(metals).where(eq(metals.code, "XAU")).get();
    const [poolRow] = await db
      .select({ total: sql<string>`SUM(CAST(${unallocatedHoldings.quantityKg} AS REAL))` })
      .from(unallocatedHoldings)
      .where(eq(unallocatedHoldings.metalId, xau!.id))
      .all();
    const pool = D(poolRow.total ?? "0");
    expect(pool.toNumber()).toBe(20);

    const shareFor = async (accountId: string) => {
      const holding = await db
        .select()
        .from(unallocatedHoldings)
        .where(
          and(
            eq(unallocatedHoldings.accountId, accountId),
            eq(unallocatedHoldings.metalId, xau!.id),
          ),
        )
        .get();
      return D(holding!.quantityKg).dividedBy(pool).times(100).toFixed(2);
    };

    expect(await shareFor(a.account.id)).toBe("50.00");
    expect(await shareFor(b.account.id)).toBe("25.00");
    expect(await shareFor(c.account.id)).toBe("25.00");
  });

  it("returns null valuation when no market price exists for a metal", async () => {
    const { account } = await createCustomerAndAccount();

    // Gold has a price; platinum does not.
    await recordMarketPrice({ metalCode: "XAU", pricePerKg: "65000" });

    await recordDeposit({
      storageType: "unallocated",
      accountId: account.id,
      metalCode: "XAU",
      vaultId,
      quantityKg: "1",
    });
    await recordDeposit({
      storageType: "unallocated",
      accountId: account.id,
      metalCode: "XPT",
      vaultId,
      quantityKg: "2",
    });

    const xau = await db.select().from(metals).where(eq(metals.code, "XAU")).get();
    const xpt = await db.select().from(metals).where(eq(metals.code, "XPT")).get();

    const valuation = await valuateAccount({
      unallocated: [
        { metalId: xau!.id, quantityKg: "1" },
        { metalId: xpt!.id, quantityKg: "2" },
      ],
      allocated: [],
    });

    const gold = valuation.perMetal.find((m) => m.metalCode === "XAU");
    const plat = valuation.perMetal.find((m) => m.metalCode === "XPT");
    expect(gold?.valueUSD).toBe("65000.00");
    expect(plat?.valueUSD).toBeNull();
    expect(plat?.pricePerKg).toBeNull();
    // Total only counts priced metals.
    expect(valuation.totalUSD).toBe("65000.00");
  });
});
