import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/sqlite-core";

const uuid = () => crypto.randomUUID();
const ts = (name: string) =>
  integer(name, { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

export const metals = sqliteTable("metals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  unit: text("unit").notNull().default("kg"),
  createdAt: ts("created_at"),
});

export const vaults = sqliteTable("vaults", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  location: text("location"),
  createdAt: ts("created_at"),
});

export const customers = sqliteTable(
  "customers",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    clientType: text("client_type", { enum: ["retail", "institutional"] }).notNull(),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [uniqueIndex("customers_email_uq").on(t.email)],
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    accountNumber: text("account_number").notNull(),
    status: text("status", { enum: ["active", "closed"] })
      .notNull()
      .default("active"),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [
    uniqueIndex("accounts_account_number_uq").on(t.accountNumber),
    index("accounts_customer_idx").on(t.customerId),
  ],
);

export const marketPrices = sqliteTable(
  "market_prices",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    metalId: integer("metal_id")
      .notNull()
      .references(() => metals.id, { onDelete: "restrict" }),
    pricePerKg: text("price_per_kg").notNull(),
    currency: text("currency").notNull().default("USD"),
    effectiveAt: integer("effective_at", { mode: "timestamp_ms" }).notNull(),
    source: text("source").notNull().default("manual"),
    createdAt: ts("created_at"),
  },
  (t) => [index("market_prices_metal_effective_idx").on(t.metalId, t.effectiveAt)],
);

export const bars = sqliteTable(
  "bars",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    serialNumber: text("serial_number").notNull(),
    metalId: integer("metal_id")
      .notNull()
      .references(() => metals.id, { onDelete: "restrict" }),
    weightKg: text("weight_kg").notNull(),
    purity: text("purity").notNull(),
    vaultId: integer("vault_id")
      .notNull()
      .references(() => vaults.id, { onDelete: "restrict" }),
    currentAccountId: text("current_account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    status: text("status", { enum: ["in_custody", "withdrawn"] })
      .notNull()
      .default("in_custody"),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [
    uniqueIndex("bars_serial_number_uq").on(t.serialNumber),
    index("bars_account_status_idx").on(t.currentAccountId, t.status),
    check("bars_purity_range", sql`CAST(${t.purity} AS REAL) > 0 AND CAST(${t.purity} AS REAL) <= 1`),
    check("bars_weight_positive", sql`CAST(${t.weightKg} AS REAL) > 0`),
  ],
);

export const unallocatedHoldings = sqliteTable(
  "unallocated_holdings",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    metalId: integer("metal_id")
      .notNull()
      .references(() => metals.id, { onDelete: "restrict" }),
    quantityKg: text("quantity_kg").notNull().default("0"),
    updatedAt: ts("updated_at"),
  },
  (t) => [
    uniqueIndex("unallocated_holdings_account_metal_uq").on(t.accountId, t.metalId),
    check("unallocated_holdings_qty_non_negative", sql`CAST(${t.quantityKg} AS REAL) >= 0`),
  ],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    referenceNumber: text("reference_number").notNull(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    metalId: integer("metal_id")
      .notNull()
      .references(() => metals.id, { onDelete: "restrict" }),
    type: text("type", { enum: ["deposit", "withdrawal"] }).notNull(),
    storageType: text("storage_type", { enum: ["allocated", "unallocated"] }).notNull(),
    quantityKg: text("quantity_kg").notNull(),
    barId: text("bar_id").references(() => bars.id, { onDelete: "restrict" }),
    vaultId: integer("vault_id")
      .notNull()
      .references(() => vaults.id, { onDelete: "restrict" }),
    pricePerKgAtTime: text("price_per_kg_at_time"),
    notes: text("notes"),
    createdAt: ts("created_at"),
  },
  (t) => [
    uniqueIndex("transactions_reference_uq").on(t.referenceNumber),
    index("transactions_account_idx").on(t.accountId),
    index("transactions_account_created_idx").on(t.accountId, t.createdAt),
    index("transactions_bar_idx").on(t.barId),
    check("transactions_qty_positive", sql`CAST(${t.quantityKg} AS REAL) > 0`),
    check(
      "transactions_allocated_has_bar",
      sql`(${t.storageType} = 'unallocated' AND ${t.barId} IS NULL)
          OR (${t.storageType} = 'allocated' AND ${t.barId} IS NOT NULL)`,
    ),
  ],
);

// Atomic counters for human-readable reference numbers (e.g. ACC-2026-000001).
// Each row is a (prefix, year) bucket; UPSERT + RETURNING gives us a serialised counter.
export const counters = sqliteTable("counters", {
  prefix: text("prefix").notNull(),
  year: integer("year").notNull(),
  value: integer("value").notNull().default(0),
}, (t) => [uniqueIndex("counters_prefix_year_uq").on(t.prefix, t.year)]);

export type Metal = typeof metals.$inferSelect;
export type Vault = typeof vaults.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type MarketPrice = typeof marketPrices.$inferSelect;
export type NewMarketPrice = typeof marketPrices.$inferInsert;
export type Bar = typeof bars.$inferSelect;
export type NewBar = typeof bars.$inferInsert;
export type UnallocatedHolding = typeof unallocatedHoldings.$inferSelect;
export type NewUnallocatedHolding = typeof unallocatedHoldings.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
