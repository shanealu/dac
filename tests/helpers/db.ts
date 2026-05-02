import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db, raw } from "@/lib/db/client";
import { accounts, customers, metals, vaults } from "@/lib/db/schema";

let migrated = false;

function ensureSchema() {
  if (migrated) return;
  migrate(db, { migrationsFolder: "./drizzle" });
  migrated = true;
}

/** Wipe every table and re-seed reference data (metals + one vault). */
export async function resetDb() {
  ensureSchema();
  raw.exec(`
    DELETE FROM transactions;
    DELETE FROM unallocated_holdings;
    DELETE FROM bars;
    DELETE FROM accounts;
    DELETE FROM customers;
    DELETE FROM market_prices;
    DELETE FROM vaults;
    DELETE FROM metals;
    DELETE FROM counters;
  `);

  const metalRows = await db
    .insert(metals)
    .values([
      { code: "XAU", name: "Gold", unit: "kg" },
      { code: "XAG", name: "Silver", unit: "kg" },
      { code: "XPT", name: "Platinum", unit: "kg" },
    ])
    .returning();

  const vaultRows = await db
    .insert(vaults)
    .values([{ code: "MLE-VAULT-01", name: "Test Vault", location: "Test" }])
    .returning();

  return { metals: metalRows, vaults: vaultRows };
}

let customerCounter = 0;

/** Create a customer + one account and return both. */
export async function createCustomerAndAccount(
  overrides: Partial<{ name: string; email: string; clientType: "retail" | "institutional" }> = {},
) {
  customerCounter += 1;
  const [customer] = await db
    .insert(customers)
    .values({
      name: overrides.name ?? `Test Customer ${customerCounter}`,
      email: overrides.email ?? `test${customerCounter}@example.com`,
      clientType: overrides.clientType ?? "institutional",
    })
    .returning();

  const [account] = await db
    .insert(accounts)
    .values({
      customerId: customer.id,
      accountNumber: `ACC-TEST-${String(customerCounter).padStart(6, "0")}`,
    })
    .returning();

  return { customer, account };
}
