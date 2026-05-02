import { db, raw } from "./client";
import { accounts, customers, marketPrices, metals, vaults } from "./schema";

const log = (msg: string) => console.log(`[seed] ${msg}`);

async function main() {
  log("clearing existing data");
  raw.exec(`
    DELETE FROM unallocated_holdings;
    DELETE FROM accounts;
    DELETE FROM customers;
    DELETE FROM market_prices;
    DELETE FROM vaults;
    DELETE FROM metals;
    DELETE FROM counters;
  `);

  log("seeding metals");
  const metalRows = await db
    .insert(metals)
    .values([
      { code: "XAU", name: "Gold", unit: "kg" },
      { code: "XAG", name: "Silver", unit: "kg" },
      { code: "XPT", name: "Platinum", unit: "kg" },
    ])
    .returning();

  log("seeding vaults");
  const vaultRows = await db
    .insert(vaults)
    .values([
      { code: "MLE-VAULT-01", name: "Malé Primary Vault", location: "Malé, Maldives" },
      { code: "MLE-VAULT-02", name: "Hulhumalé Secondary Vault", location: "Hulhumalé, Maldives" },
    ])
    .returning();

  log("seeding market prices");
  const now = new Date();
  await db.insert(marketPrices).values([
    { metalId: metalRows[0].id, pricePerKg: "65000.00000000", effectiveAt: now },
    { metalId: metalRows[1].id, pricePerKg: "950.00000000", effectiveAt: now },
    { metalId: metalRows[2].id, pricePerKg: "31500.00000000", effectiveAt: now },
  ]);

  log("seeding demo customer + account");
  const [demoCustomer] = await db
    .insert(customers)
    .values({
      name: "Acme Holdings Pvt",
      email: "ops@acme.mv",
      phone: "+9607771234",
      clientType: "institutional",
    })
    .returning();

  const [retailCustomer] = await db
    .insert(customers)
    .values({
      name: "Aishath Saeed",
      email: "aishath.saeed@example.mv",
      phone: "+9607778765",
      clientType: "retail",
    })
    .returning();

  await db.insert(accounts).values([
    { customerId: demoCustomer.id, accountNumber: "ACC-2026-000001" },
    { customerId: retailCustomer.id, accountNumber: "ACC-2026-000002" },
  ]);

  // Seed counters so service-layer reference-number generation continues from here.
  raw.prepare(
    `INSERT INTO counters (prefix, year, value) VALUES ('ACC', ?, 2), ('TXN', ?, 0)`,
  ).run(now.getFullYear(), now.getFullYear());

  log(`done — ${metalRows.length} metals, ${vaultRows.length} vaults, 2 customers, 2 accounts`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
