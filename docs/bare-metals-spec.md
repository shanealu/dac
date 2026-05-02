# Digital Asset Custody Platform — Technical Specification

**Project:** Bare Metals Pvt — Digital Asset Custody Platform
**Assessment:** Assessment 2 (Maldives Securities Depository)
**Document version:** 1.2
**Last updated:** 2026-05-02 — aligned with the scaffolded codebase (bun, Tailwind v4, shadcn v4 `base-nova`, Base UI). Pivoted data layer from Postgres → SQLite (better-sqlite3) for zero-setup demo runtime; rationale in §2 and §10.

---

## 1. Project Overview

### 1.1 Purpose
A digital platform for **Bare Metals Pvt**, a precious-metals custodian. The system tracks customer accounts, asset deposits, withdrawals, valuations, and supports two distinct storage models (allocated and unallocated) across multiple metals (gold, silver, platinum) and vaults.

### 1.2 What this assessment is really testing
The evaluation criteria are *interpretation, design quality, reasoning, and implementation decisions* — not a checklist. This means:
- **The README is part of the deliverable.** Every architectural choice needs a one-line "why."
- **The data model is the centerpiece.** Allocated vs unallocated have fundamentally different shapes; getting this right demonstrates understanding.
- **Edge case handling proves rigor.** They asked for 5; this spec documents 8.
- **Incremental commits matter.** They'll review the git history.
- **You'll present it.** Optimize for explainability, not feature count.

### 1.3 Scope
- Backend API + modern web UI
- Customer & account management
- Deposits and withdrawals (both storage models)
- Market price administration + portfolio valuation
- Immutable transaction ledger for audit trail
- Architecture diagram + data model + edge case docs

### 1.4 Non-goals (deliberately out of scope, mention in README)
- Authentication / authorization (mention as enhancement)
- Multi-currency (USD only)
- Real market data feed integration (manual price entry)
- Multi-tenancy / multi-company support
- Notifications / emails
- File uploads (KYC documents, etc.)
- Bar transfer between vaults / accounts (mention as enhancement)
- Reconciliation reports / regulatory exports

---

## 2. Tech Stack

The scaffold (already committed) fixes some of these choices. Locked-in items are flagged ✓ scaffolded; the rest are still proposed and can change as we go.

| Component        | Choice                                                  | Status         | Reasoning                                                  |
|------------------|---------------------------------------------------------|----------------|------------------------------------------------------------|
| Framework        | Next.js 16.2 (App Router, RSC)                          | ✓ scaffolded   | Server components, route handlers, single deployable unit  |
| Runtime / pkg mgr| Node 20+, **bun** (`bun.lock`) for install + scripts    | ✓ scaffolded   | Fast install; project already uses `bun run dev/build/lint` |
| Language         | TypeScript 5 (strict)                                   | ✓ scaffolded   | Type safety matters for financial data                     |
| Database         | **SQLite** via `better-sqlite3` (file-based, WAL mode)  | committed      | Zero local setup; single `.db` file is gitignored, easy to nuke + reseed for the demo. The brief explicitly allows non-Postgres SQL. Trade-off discussed in §10. |
| ORM              | Drizzle ORM (`drizzle-orm/better-sqlite3`)              | committed      | SQL-first, transparent transactions, precise decimal handling via `numeric()` columns stored as TEXT round-tripping through `decimal.js` |
| Validation       | Zod                                                     | proposed       | Single source of truth for API + form validation           |
| Decimal math     | `decimal.js`                                            | proposed       | JavaScript's `number` type loses precision; never used for money or weights |
| Styling          | Tailwind CSS v4 (`@tailwindcss/postcss`)                | ✓ scaffolded   | v4 is config-less — theme tokens live in `app/globals.css` via `@theme inline`, no `tailwind.config.*` |
| UI primitives    | shadcn v4 (style `base-nova`, base color `neutral`) on `@base-ui/react` | ✓ scaffolded   | `base-nova` is the Base UI variant of shadcn — accessible headless primitives; config in `components.json` |
| Animations       | `tw-animate-css`                                        | ✓ scaffolded   | Drop-in animation utility classes for v4                   |
| Icons            | `lucide-react`                                          | ✓ scaffolded   | Default icon set for shadcn `base-nova`                    |
| Component install| shadcn MCP server (`.mcp.json`) **or** `bunx shadcn@latest add` | ✓ scaffolded   | Use the MCP for component lookup/install — do not hand-write primitives |
| Data fetching    | Server components + native `fetch`                      | proposed       | Avoid client-side state where server components suffice    |
| Forms            | React Hook Form + Zod resolver                          | proposed       | Standard pattern, integrates cleanly with shadcn           |
| Tables           | TanStack Table                                          | proposed       | Sortable/filterable transaction history                    |
| Testing          | Vitest + Testing Library                                | proposed       | Fast, zero-config                                          |

> **Why Drizzle over Prisma:** Drizzle's SQL-first surface (raw queries, indexes, CHECK constraints) keeps the financial logic legible. Prisma's `Decimal` ergonomics are weaker for fixed-point money/weight handling.

> **Why SQLite (not Postgres):** Custodial logic doesn't need Postgres-only features for this prototype. SQLite + WAL gives us ACID transactions, foreign keys, CHECK and UNIQUE constraints, and indexes — everything the schema actually exercises. Concurrency model is different (see §10) and we lean into that rather than fight it.

> **Next.js 16 caveat (per `AGENTS.md`):** APIs, conventions, and file structure differ from older Next.js. Read the relevant guide in `node_modules/next/dist/docs/` before introducing new patterns; heed deprecation notices.

---

## 3. Architecture & Design Patterns

### 3.1 Layered architecture

```
┌─────────────────────────────────────────────┐
│  Pages (Server Components)                  │  reads via DB layer directly
│  Client Components (forms, interactive UI)  │  mutate via Route Handlers
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│  Route Handlers (app/api/**)                │  thin: parse → validate → service
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│  Service layer (lib/services/**)            │  business logic + transactions
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│  Data access (lib/db/**)                    │  Drizzle queries, schema, types
└────────────────────┬────────────────────────┘
                     │
                PostgreSQL
```

### 3.2 Layer responsibilities

| Layer               | Responsibility                                                  |
|---------------------|-----------------------------------------------------------------|
| **Server components** | Server-side reads via the DB layer. No business logic.       |
| **Client components** | Interactive UI (forms, tables). Call route handlers.         |
| **Route handlers**   | HTTP I/O. Parse, validate (Zod), delegate to service. No DB calls. |
| **Services**         | All business logic, transactions, audit logging. Pure functions of inputs. |
| **DB layer**         | Drizzle schema, query builders, types. No business logic.    |

### 3.3 Why this design
- **Server components for reads** = no boilerplate API endpoints for "show portfolio." Direct DB access from React is the App Router's win.
- **Route handlers for mutations** = explicit, documentable, curl-able. Satisfies "Example API calls" in the README.
- **Service layer is pure** = easy to test, easy to reuse from server actions or route handlers.
- **Maps to "Design quality" rubric** — separation of concerns, explainable in a presentation.

### 3.4 What I'm deliberately not doing
- **No "use server" actions.** Two mutation paths (actions + handlers) means two test surfaces. Stick with route handlers.
- **No Repository pattern.** Drizzle's query builder is already a thin abstraction; another layer is over-engineering.
- **No CQRS / event sourcing.** The transaction ledger gives 80% of the audit benefits without the complexity. Mention as a possible evolution.

---

## 4. Domain Model & Key Concepts

This section is the most important part of the spec. Understanding these concepts drives every schema and API decision below.

### 4.1 The two storage models

**Allocated storage (institutional):**
- Each physical bar is an individually tracked asset.
- Bars have unique serial numbers, specific weights (not always 1kg), and purity ratings.
- Ownership is bar-level: bar #ABC123 belongs to Account 42.
- Deposits add a bar; withdrawals remove a specific bar.
- Two institutions' bars can sit in the same vault but in the ledger they're separate.

**Unallocated storage (retail):**
- Metals are pooled. Customers own a *quantity* (kg) of the pool, which translates to a *percentage* of the total pool.
- Deposits add quantity to a customer's holding and to the pool total.
- Withdrawals subtract.
- Customer A's percentage shifts every time another customer deposits or withdraws — but their kg held does not.

### 4.2 The critical insight: store quantity, derive percentage

A naïve design stores "Customer A owns 60% of the gold pool." This is wrong because every new deposit by anyone forces an update to *every* customer row. Instead:

- Store `quantity_kg` per customer per metal.
- Pool total = `SUM(quantity_kg)` across all customers for that metal.
- Customer's percentage = `customer.quantity_kg / pool_total` — computed at read time.

This is a significant design decision. Document it explicitly in the README.

### 4.3 Are storage models tied to customer type?

The brief says "retail = unallocated, institutional = allocated." Reading literally, this is a 1:1 mapping. But real custody allows hybrid holdings (an institution might hold a small unallocated position alongside their bars).

**Decision for this implementation:** the storage model is a property of the *transaction*, not the customer. `client_type` on the customer is informational and defaults the UI's storage selector, but the system permits any account to hold either or both. Document this in the README as an interpretive choice — it's exactly the kind of "interpretation" the rubric rewards.

### 4.4 Valuation

- A `market_prices` table records spot price per metal over time (manual entry by admin).
- "Current price" = most recent row by `effective_at`.
- An account's valuation = sum across holdings of `(quantity_kg × current_price_per_kg)` for unallocated, plus sum of `(bar.weight_kg × current_price)` for allocated bars owned.
- If no price exists for a metal, the holding is shown as "Unpriced" — never zero, never an error.

### 4.5 Extensibility to silver and platinum

The brief explicitly calls this out. Design implication: metals are a *table*, not an enum. Adding silver = inserting one row. The `metals` table has `code` (XAU, XAG, XPT — ISO 4217-style) and `name`. Every other table references `metal_id`.

### 4.6 The transaction ledger

Every deposit and withdrawal writes a row to a `transactions` table that is **append-only** in application logic. Holdings and bar states are denormalized caches; the ledger is the source of truth. If the cache ever drifts from the ledger, the ledger wins. Document this principle in the README.

---

## 5. Database Schema

PostgreSQL. All money/weight columns use `NUMERIC(20, 8)` — 20 digits total, 8 decimal places. This handles weights down to 100 micrograms and prices in any reasonable currency.

### 5.1 `metals`
| Column     | Type            | Notes                                |
|------------|-----------------|--------------------------------------|
| id         | serial PK       |                                      |
| code       | varchar(8) UQ   | XAU, XAG, XPT                        |
| name       | varchar(50)     | Gold, Silver, Platinum               |
| unit       | varchar(8)      | 'kg' for now                         |
| created_at | timestamptz     |                                      |

Seed with Gold (XAU), Silver (XAG), Platinum (XPT).

### 5.2 `vaults`
| Column     | Type            | Notes                                |
|------------|-----------------|--------------------------------------|
| id         | serial PK       |                                      |
| code       | varchar(16) UQ  | e.g., MLE-VAULT-01                   |
| name       | varchar(120)    |                                      |
| location   | varchar(255)    |                                      |
| created_at | timestamptz     |                                      |

Seed with one or two vaults.

### 5.3 `customers`
| Column      | Type            | Notes                                |
|-------------|-----------------|--------------------------------------|
| id          | uuid PK         | `gen_random_uuid()` default          |
| name        | varchar(120)    | not null                             |
| email       | varchar(255) UQ | not null                             |
| phone       | varchar(30)     | nullable                             |
| client_type | varchar(20)     | 'retail' or 'institutional'          |
| created_at  | timestamptz     |                                      |
| updated_at  | timestamptz     |                                      |

### 5.4 `accounts`
| Column         | Type            | Notes                                       |
|----------------|-----------------|---------------------------------------------|
| id             | uuid PK         |                                             |
| customer_id    | uuid FK         | → customers.id                              |
| account_number | varchar(20) UQ  | e.g., ACC-2026-000001 (public-facing)       |
| status         | varchar(20)     | 'active' or 'closed', default 'active'     |
| created_at     | timestamptz     |                                             |
| updated_at     | timestamptz     |                                             |

One customer can have multiple accounts (mention as flexibility, even if UI only creates one).

### 5.5 `market_prices`
| Column        | Type            | Notes                                |
|---------------|-----------------|--------------------------------------|
| id            | bigserial PK    |                                      |
| metal_id      | int FK          | → metals.id                          |
| price_per_kg  | numeric(20,8)   | not null, must be > 0                |
| currency      | varchar(3)      | 'USD' for now                        |
| effective_at  | timestamptz     | not null, indexed                    |
| source        | varchar(20)     | 'manual' for now                     |
| created_at    | timestamptz     |                                      |

Index on `(metal_id, effective_at DESC)` for fast "latest price" lookups.

### 5.6 `bars` — allocated storage
| Column             | Type            | Notes                                                  |
|--------------------|-----------------|--------------------------------------------------------|
| id                 | uuid PK         |                                                        |
| serial_number      | varchar(64) UQ  | physical bar serial — unique constraint critical       |
| metal_id           | int FK          | → metals.id                                            |
| weight_kg          | numeric(20,8)   | actual weight; bars vary (~0.4kg "kilobar" to 12.5kg LBMA "good delivery") |
| purity             | numeric(6,4)    | 0.0000–1.0000, e.g., 0.9999 for "four nines fine"      |
| vault_id           | int FK          | → vaults.id                                            |
| current_account_id | uuid FK NULL    | → accounts.id; null = not currently held by any client |
| status             | varchar(20)     | 'in_custody' or 'withdrawn'                            |
| created_at         | timestamptz     |                                                        |
| updated_at         | timestamptz     |                                                        |

Index on `(current_account_id, status)`. Unique on `serial_number` — this is the foundation of allocated storage's integrity.

### 5.7 `unallocated_holdings` — pooled storage
| Column      | Type            | Notes                                              |
|-------------|-----------------|----------------------------------------------------|
| id          | uuid PK         |                                                    |
| account_id  | uuid FK         | → accounts.id                                      |
| metal_id    | int FK          | → metals.id                                        |
| quantity_kg | numeric(20,8)   | must be ≥ 0; CHECK constraint                      |
| updated_at  | timestamptz     |                                                    |

Unique constraint on `(account_id, metal_id)` — one holding row per account per metal. CHECK constraint `quantity_kg >= 0` — defense in depth against ever going negative at the DB layer.

### 5.8 `transactions` — the immutable ledger
| Column           | Type            | Notes                                                       |
|------------------|-----------------|-------------------------------------------------------------|
| id               | uuid PK         |                                                             |
| reference_number | varchar(24) UQ  | e.g., TXN-2026-000001                                       |
| account_id       | uuid FK         | → accounts.id                                               |
| metal_id         | int FK          | → metals.id                                                 |
| type             | varchar(20)     | 'deposit' or 'withdrawal'                                   |
| storage_type     | varchar(20)     | 'allocated' or 'unallocated'                                |
| quantity_kg      | numeric(20,8)   | always positive; sign comes from `type`                     |
| bar_id           | uuid FK NULL    | → bars.id; required if storage_type='allocated', else null  |
| vault_id         | int FK          | → vaults.id                                                 |
| price_per_kg_at_time | numeric(20,8) | snapshot of market price; null if no price was set         |
| notes            | text            | nullable                                                    |
| created_at       | timestamptz     | indexed                                                     |

Indexes on `account_id`, `(account_id, created_at DESC)`, `bar_id`. **No `updated_at`** — append-only. Application code must never UPDATE this table.

### 5.9 Why no separate `deposits` and `withdrawals` tables?
A single `transactions` table is the ledger pattern. It's simpler, queries are cleaner, and a transfer (future enhancement) would naturally fit as a paired transaction or new type. Document this in the README.

### 5.10 Schema diagram (Mermaid — for the README)

```mermaid
erDiagram
    customers ||--o{ accounts : has
    accounts ||--o{ transactions : records
    accounts ||--o{ unallocated_holdings : owns
    accounts ||--o{ bars : "owns (current)"
    metals ||--o{ market_prices : priced_by
    metals ||--o{ unallocated_holdings : type
    metals ||--o{ bars : type
    metals ||--o{ transactions : type
    vaults ||--o{ bars : stores
    vaults ||--o{ transactions : at
    bars ||--o{ transactions : "movement of"
```

---

## 6. API Specifications

### 6.1 Conventions
- Base: `/api`
- Content-Type: `application/json`
- Response envelope: `{ data, meta?, error? }`
- Validation: Zod on every input; failures return 422 with field-level errors
- Timestamps: ISO 8601 UTC

### 6.2 Customers

**`POST /api/customers`** — create a customer
```json
// request
{ "name": "Acme Holdings", "email": "ops@acme.mv", "phone": "+9607...", "clientType": "institutional" }
// response 201
{ "data": { "id": "...", "name": "...", "email": "...", "clientType": "institutional", "createdAt": "..." } }
```

**`GET /api/customers`** — list (paginated)
**`GET /api/customers/[id]`** — single, including accounts

### 6.3 Accounts

**`POST /api/accounts`** — create an account for a customer
```json
{ "customerId": "uuid" }
// returns account with auto-generated account_number
```

**`GET /api/accounts/[id]`** — full account view
```json
{
  "data": {
    "id": "...",
    "accountNumber": "ACC-2026-000001",
    "customer": { ... },
    "holdings": {
      "unallocated": [
        { "metal": "Gold", "quantityKg": "12.50000000", "valuation": { "amount": "812500.00", "currency": "USD", "asOf": "..." } }
      ],
      "allocated": [
        { "barId": "...", "serial": "AU-001-2026", "metal": "Gold", "weightKg": "1.0000", "purity": "0.9999", "valuation": { ... } }
      ]
    },
    "totalValuation": { "amount": "...", "currency": "USD", "asOf": "..." }
  }
}
```

### 6.4 Deposits

**`POST /api/deposits`** — record a deposit
```json
// unallocated
{
  "accountId": "uuid",
  "metalCode": "XAU",
  "storageType": "unallocated",
  "quantityKg": "10.5",
  "vaultId": 1,
  "notes": "Jan delivery from Bank X"
}

// allocated
{
  "accountId": "uuid",
  "metalCode": "XAU",
  "storageType": "allocated",
  "vaultId": 1,
  "bar": {
    "serialNumber": "AU-2026-00042",
    "weightKg": "12.4567",
    "purity": "0.9999"
  },
  "notes": "..."
}
```

Returns the created `Transaction` plus, for allocated, the `Bar`.

### 6.5 Withdrawals

**`POST /api/withdrawals`** — record a withdrawal
```json
// unallocated
{ "accountId": "uuid", "metalCode": "XAU", "storageType": "unallocated", "quantityKg": "2.0", "vaultId": 1 }

// allocated
{ "accountId": "uuid", "barId": "uuid" }
```

Allocated withdrawal only needs the bar ID — type, weight, account ownership are looked up.

### 6.6 Transactions

**`GET /api/transactions?accountId=...&type=...&from=...&to=...&page=1&perPage=20`**
Returns the transaction ledger filtered, sorted by `createdAt DESC`.

### 6.7 Market prices

**`POST /api/market-prices`** — admin sets a price
```json
{ "metalCode": "XAU", "pricePerKg": "65000.00", "currency": "USD", "effectiveAt": "2026-04-30T00:00:00Z" }
```

**`GET /api/market-prices/current`** — latest price per metal
**`GET /api/market-prices?metalCode=XAU`** — price history

### 6.8 Standard error responses
- 400 — malformed JSON
- 404 — not found
- 409 — conflict (duplicate serial, withdraw already-withdrawn bar)
- 422 — validation failure
- 500 — unexpected (logged, generic message returned)

---

## 7. UI Specifications

The brief asks for a "modern UI that allows interacting with key flows." Build *enough* — not a full admin panel.

### 7.1 Pages

| Route                       | Purpose                                                  |
|-----------------------------|----------------------------------------------------------|
| `/`                         | Landing / dashboard with totals across all accounts      |
| `/customers`                | List + create customer                                   |
| `/customers/[id]`           | Customer detail with their accounts                      |
| `/accounts/[id]`            | **Core view:** portfolio, holdings, valuation, history   |
| `/accounts/[id]/deposit`    | Deposit form                                             |
| `/accounts/[id]/withdraw`   | Withdrawal form                                          |
| `/admin/prices`             | Manage market prices                                     |
| `/admin/bars`               | Search/inspect bars (allocated)                          |

### 7.2 Account detail page — the centerpiece for the demo

This is what you'll spend most of your presentation showing. Lay it out as:

1. **Header:** account number, customer name, total valuation, last price update
2. **Tabs:** "Unallocated" / "Allocated" / "Transactions"
3. **Unallocated tab:** card per metal showing kg held + current valuation + % share of pool
4. **Allocated tab:** table of bars with serial, metal, weight, purity, valuation, "Withdraw" action
5. **Transactions tab:** filterable table (type, metal, date range)

### 7.3 Forms

- **Deposit form:** storage-type tabs at the top (Unallocated / Allocated). Allocated reveals serial/weight/purity fields. Unallocated reveals quantity. Both share metal + vault selectors. Inline validation.
- **Withdrawal form:** for unallocated — show available balance, prevent submitting more. For allocated — list of bars owned, click to withdraw with confirmation.

### 7.4 Visual style
Use the shadcn `base-nova` defaults already wired up in `app/globals.css` (neutral palette, OKLCH tokens, dark-mode variant via `@custom-variant dark (&:is(.dark *))`). Don't theme heavily. The brief says "modern UI" which means clean, spaced, accessible — not branded. Pull components in via the shadcn MCP (or `bunx shadcn@latest add <name>`); don't hand-write primitives.

### 7.5 Loading & error states
- Server components show skeletons while data resolves
- Mutations show toast notifications (sonner) on success/failure
- Failed validations highlight fields inline

---

## 8. Key Business Rules & Edge Cases

The brief asks for **at least 5 documented edge cases**. Here are 8 — over-deliver, since this is what the rubric directly rewards. Include this section in the README too.

### 8.1 Overdraft on unallocated withdrawal
**Scenario:** Customer requests 10kg withdrawal but holds only 6kg.
**Handling:** Service-layer check inside the DB transaction. Reject with 422 and clear message. The DB has a `CHECK (quantity_kg >= 0)` constraint as a final safety net.

### 8.2 Withdraw a bar that's already been withdrawn
**Scenario:** Two operators try to withdraw bar #ABC at the same time.
**Handling:** `SELECT ... FOR UPDATE` on the bar row inside the transaction. Second operator's transaction sees `status='withdrawn'` and returns 409 Conflict.

### 8.3 Withdraw a bar that doesn't belong to the requesting account
**Scenario:** Account B asks to withdraw bar owned by Account A.
**Handling:** Service checks `bar.current_account_id === request.accountId`. Returns 403/404 if mismatch — don't leak the bar's existence.

### 8.4 Concurrent deposits affecting pool share calculations
**Scenario:** Two customers deposit unallocated gold simultaneously; both reads see the same pool total before either writes.
**Handling:** Pool share is *derived at read time*, not stored. So this race doesn't corrupt anything. But the holdings update itself uses `SELECT ... FOR UPDATE` to prevent two simultaneous deposits to the *same account+metal* from clobbering each other.

### 8.5 Deposit of zero or negative quantity
**Handling:** Zod schema rejects with `quantityKg: z.string().refine(v => new Decimal(v).gt(0))`. Defense in depth: DB has `CHECK (quantity_kg > 0)` on the transactions table.

### 8.6 Duplicate bar serial number
**Scenario:** Operator tries to deposit bar with a serial already in the system.
**Handling:** Unique constraint on `bars.serial_number` raises a DB error inside the transaction, which the service catches and returns 409 with a meaningful message. Don't try to "find and merge" — duplicate serials in real custody indicate fraud or operational error and must surface loudly.

### 8.7 Valuation when no market price exists for a metal
**Scenario:** Platinum has no price in the system but customer holds platinum.
**Handling:** Valuation returns `{ amount: null, status: "unpriced", asOf: null }`. UI renders as "—" with a tooltip explaining no price is available. Never silently treat as zero.

### 8.8 Currency precision
**Scenario:** Dividing 1kg pool among 3 customers with float math gives 0.333... and rounding errors compound across many transactions.
**Handling:** All arithmetic uses `decimal.js`. DB uses `NUMERIC(20,8)`. Never use JS `number` for any quantity, weight, or price. The `Decimal` type round-trips through Drizzle as a string. This is the single most important implementation detail — call it out in the README.

> **Optional ninth edge case to mention in README:** transfer of bar ownership between accounts (intentionally out of scope; brief doesn't require it; would be modeled as paired withdrawal+deposit transactions in a future iteration).

---

## 9. Validation Strategy

### 9.1 Zod schemas as the single source of truth
Define one Zod schema per request shape in `lib/validation/`. Use it both in route handlers (request body) and on the client (React Hook Form resolver). One place to update.

```typescript
// lib/validation/deposit.ts
export const depositSchema = z.discriminatedUnion('storageType', [
  z.object({
    storageType: z.literal('unallocated'),
    accountId: z.string().uuid(),
    metalCode: z.enum(['XAU', 'XAG', 'XPT']),
    quantityKg: z.string().refine(v => new Decimal(v).gt(0), 'Must be > 0'),
    vaultId: z.number().int().positive(),
    notes: z.string().max(500).optional(),
  }),
  z.object({
    storageType: z.literal('allocated'),
    accountId: z.string().uuid(),
    metalCode: z.enum(['XAU', 'XAG', 'XPT']),
    vaultId: z.number().int().positive(),
    bar: z.object({
      serialNumber: z.string().min(1).max(64),
      weightKg: z.string().refine(v => new Decimal(v).gt(0)),
      purity: z.string().refine(v => {
        const n = new Decimal(v);
        return n.gt(0) && n.lte(1);
      }),
    }),
    notes: z.string().max(500).optional(),
  }),
]);
```

The `discriminatedUnion` on `storageType` gives type-safe branching in the service layer.

### 9.2 Three layers of defense
1. **Zod** at the API boundary
2. **Service-layer business checks** (balance, ownership, status)
3. **DB constraints** (CHECK, UNIQUE, FK) as last line

---

## 10. Transaction Handling & Concurrency

### 10.1 What needs a DB transaction
Every mutation is wrapped in a Drizzle transaction:
- **Deposit (unallocated):** read-or-create holding → upsert quantity → write ledger row
- **Deposit (allocated):** insert bar (UNIQUE serial guards duplicates) → write ledger row
- **Withdrawal (unallocated):** read holding → check balance → decrement → write ledger row
- **Withdrawal (allocated):** read bar → check ownership + status → update bar → write ledger row

If any step fails, the whole transaction rolls back; the ledger never sees a half-written state.

### 10.2 Concurrency on SQLite
Postgres-style row-level `SELECT ... FOR UPDATE` doesn't exist on SQLite. Instead we lean on SQLite's own model:

- **WAL mode + `BEGIN IMMEDIATE`** at the start of every write transaction. This grabs the writer lock up-front, so two concurrent withdrawals serialize at the database level — the second waits, then sees the updated state when it runs.
- **`PRAGMA foreign_keys = ON`** to enforce FK integrity.
- `better-sqlite3` is synchronous — Node's event loop already serializes JS — so there is no in-process race once we've taken the immediate transaction. Cross-process safety still relies on SQLite's file lock.
- CHECK constraints (`quantity_kg >= 0`, `quantity_kg > 0` on transactions, `purity` between 0 and 1) and UNIQUE on `bars.serial_number` are the last line of defense.

```typescript
// lib/db/client.ts initialization
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Service layer — every write
db.transaction((tx) => {
  // tx runs in IMMEDIATE mode by default in better-sqlite3
  const holding = tx.select().from(unallocatedHoldings).where(...).get();
  if (!holding || new Decimal(holding.quantityKg).lt(quantityKg)) {
    throw new InsufficientBalanceError(...);
  }
  // proceed: update + ledger insert
});
```

### 10.3 Trade-offs vs. Postgres (call this out in the README)
- **Concurrency throughput is lower:** writes serialize. For a custodial system this is conservative-by-default and acceptable.
- **`SELECT FOR UPDATE` examples in earlier spec drafts no longer apply** — replaced by `BEGIN IMMEDIATE` semantics.
- **Schema portability:** the Drizzle schema is structurally identical; moving to Postgres is a config swap (`drizzle-orm/postgres-js` + dialect change) plus a fresh migration generation. Document this in the README "Possible enhancements" section.

### 10.4 Why this matters for the rubric
"Design quality" and "implementation decisions" — be ready to explain *why* SQLite, *why* derived percentages, *why* a single ledger table. These are the questions a reviewer will ask in the presentation.

---

## 11. Error Handling

### 11.1 Custom error classes
```typescript
class DomainError extends Error { constructor(public code: string, message: string, public httpStatus: number) {...} }
class ValidationError extends DomainError {}            // 422
class NotFoundError extends DomainError {}              // 404
class InsufficientBalanceError extends DomainError {}   // 422
class BarOwnershipError extends DomainError {}          // 403
class BarAlreadyWithdrawnError extends DomainError {}   // 409
class DuplicateSerialError extends DomainError {}       // 409
```

### 11.2 Centralized handler in route handlers
```typescript
function handleError(err: unknown): Response {
  if (err instanceof DomainError) {
    return Response.json({ error: { code: err.code, message: err.message } }, { status: err.httpStatus });
  }
  if (err instanceof ZodError) {
    return Response.json({ error: { code: 'VALIDATION', issues: err.flatten() } }, { status: 422 });
  }
  console.error(err); // log full trace
  return Response.json({ error: { code: 'INTERNAL', message: 'An unexpected error occurred.' } }, { status: 500 });
}
```

Wrap every route handler. No internal details leak to clients.

---

## 12. Audit Trail

The transaction ledger *is* the audit trail. Every state change to balances or bar ownership has a corresponding `transactions` row. Document this design choice in the README:

> "Holdings and bar states are denormalized projections of the transaction ledger. The ledger is append-only and is the source of truth. A reconciliation process (out of scope for this prototype) could rebuild holdings from the ledger if drift is ever detected."

### Bonus consideration (mention in README, don't implement)
- An admin-readable `audit_log` table for non-financial events (price changes, customer profile edits) would round this out for compliance. Out of scope here.

---

## 13. Testing Strategy

The brief doesn't require tests, but they're cheap insurance and reviewers love seeing them.

### 13.1 Priority
1. **Service layer unit tests** — every business rule, especially the edge cases in §8
2. **Route handler integration tests** — happy + error paths
3. **Schema/migration smoke test** — apply migrations + seeders, query

### 13.2 Tools
- Vitest
- A throwaway PostgreSQL via Docker (`testcontainers`) or a `test_` schema

### 13.3 Must-have tests
- Deposit unallocated → holding increases, transaction row written
- Deposit allocated → bar exists, status `in_custody`, transaction row written
- Withdrawal exceeding balance → throws `InsufficientBalanceError`, no rows changed
- Withdrawal of bar from wrong account → throws `BarOwnershipError`
- Concurrent withdrawals of same bar → exactly one succeeds (run twice in parallel via `Promise.all`)
- Pool share derivation: 3 customers, 10kg/5kg/5kg → percentages compute correctly
- Valuation with missing market price → returns `unpriced`, doesn't throw

---

## 14. Project Structure

Items marked ✓ already exist in the scaffold; the rest are to be added.

```
.
├── .mcp.json                                 ✓ shadcn MCP server
├── AGENTS.md / CLAUDE.md                     ✓ agent rules; Next 16 caveat
├── components.json                           ✓ shadcn config (style=base-nova, neutral)
├── next.config.ts                            ✓
├── postcss.config.mjs                        ✓ Tailwind v4 PostCSS plugin
├── tsconfig.json                             ✓ paths: "@/*" → repo root
├── app/
│   ├── globals.css                           ✓ Tailwind v4 entry + theme tokens (OKLCH) + dark variant
│   ├── layout.tsx                            ✓ Geist + Inter fonts, cn() wired
│   ├── page.tsx                              ✓ (placeholder — replace with dashboard)
│   ├── (public)/
│   │   ├── customers/page.tsx
│   │   ├── customers/[id]/page.tsx
│   │   └── accounts/[id]/
│   │       ├── page.tsx
│   │       ├── deposit/page.tsx
│   │       └── withdraw/page.tsx
│   ├── admin/
│   │   ├── prices/page.tsx
│   │   └── bars/page.tsx
│   └── api/
│       ├── customers/route.ts
│       ├── customers/[id]/route.ts
│       ├── accounts/route.ts
│       ├── accounts/[id]/route.ts
│       ├── deposits/route.ts
│       ├── withdrawals/route.ts
│       ├── transactions/route.ts
│       └── market-prices/
│           ├── route.ts
│           └── current/route.ts
├── components/
│   ├── ui/                                   ✓ shadcn primitives (button.tsx already added)
│   └── domain/                               # AccountSummary, BarTable, DepositForm, etc.
├── lib/
│   ├── utils.ts                              ✓ cn() = twMerge(clsx(...))
│   ├── db/
│   │   ├── schema.ts                         # all Drizzle table defs
│   │   ├── client.ts                         # connection
│   │   └── seed.ts                           # seed metals + vaults
│   ├── services/
│   │   ├── customer.service.ts
│   │   ├── account.service.ts
│   │   ├── deposit.service.ts
│   │   ├── withdrawal.service.ts
│   │   ├── valuation.service.ts
│   │   └── market-price.service.ts
│   ├── validation/                           # Zod schemas
│   ├── errors.ts                             # DomainError classes
│   └── decimal.ts                            # decimal.js wrapper / helpers
├── drizzle/                                  # migration files (generated)
├── tests/
├── docs/
│   ├── Assessment 2.pdf                      ✓ original brief
│   ├── bare-metals-spec.md                   ✓ this document
│   ├── architecture.md                       # diagram + data model (extract for README)
│   ├── edge-cases.md                         # the 8 edge cases (extract for README)
│   └── api.md                                # curl examples
├── public/                                   ✓
└── README.md                                 ✓ (currently CNA default — rewrite per §15.3)
```

---

## 15. Setup & Configuration

### 15.1 Prerequisites
- Node.js 20+
- **bun** (project lockfile is `bun.lock`; `bun run` drives all scripts)
- PostgreSQL 15+ (DBngin instance from your Mac setup is fine)

### 15.2 `.env.example`
```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/bare_metals_dev"
NODE_ENV="development"
```

### 15.3 README must include
1. Project description (1 paragraph)
2. Setup steps:
   ```bash
   bun install
   cp .env.example .env
   # adjust DATABASE_URL
   bun run db:migrate
   bun run db:seed
   bun run dev
   ```
3. **Architecture overview** with the Mermaid diagram (§5.10)
4. **Data model walkthrough** — explain allocated vs unallocated, pool share derivation
5. **Assumptions and design decisions:**
   - Storage model is a property of transactions, not customers
   - Single ledger table, not separate deposits/withdrawals
   - Derived pool percentages, not stored
   - `decimal.js` for all financial math
   - No auth in scope
   - Tailwind v4 (config-less, theme tokens in `app/globals.css`) + shadcn `base-nova` on Base UI
6. **Edge cases (§8 in full)**
7. **Example API calls** (curl) for each endpoint
8. **Possible enhancements** — auth, real price feeds, bar transfers, reconciliation, multi-currency

---

## 16. Deliverables Checklist

- [ ] Working Next.js application
- [ ] PostgreSQL schema (Drizzle migrations committed)
- [ ] Seeders for metals, vaults, demo customer/account, demo prices
- [ ] All API endpoints in §6
- [ ] All UI pages in §7
- [ ] Service layer with transaction handling for every mutation
- [ ] Zod schemas for every input
- [ ] Custom error classes + centralized handler
- [ ] Mermaid architecture diagram in `docs/architecture.md`
- [ ] Data model walkthrough in README
- [ ] All 8 edge cases documented in `docs/edge-cases.md` (and summarized in README)
- [ ] curl examples in `docs/api.md`
- [ ] `bun test` (or `bun run test`) passes (even with a small set of tests)
- [ ] Incremental commits — at minimum one per item in §17
- [ ] `.env` in `.gitignore`; `.env.example` committed
- [ ] README's "assumptions and decisions" section is complete

---

## 17. Suggested Implementation Order (one commit per step)

Each step should be a discrete commit. Reviewers will check the git history.

1. ✓ **Done in initial commit** — `chore: scaffold Next.js 16 + TypeScript + Tailwind v4 + shadcn base-nova on Base UI` (bun, `.mcp.json` for shadcn, `lib/utils.ts`, `components/ui/button.tsx`)
2. `chore: add PostgreSQL setup, Drizzle config, env example`
3. `feat(db): metals, vaults, market_prices schemas + migration + seed`
4. `feat(db): customers, accounts schemas + migration`
5. `feat(db): bars, unallocated_holdings, transactions schemas + migration`
6. `feat(api): customers + accounts endpoints`
7. `feat(api): market price admin endpoints`
8. `feat(services): valuation service with current-price lookup + unpriced handling`
9. `feat(services): deposit service (unallocated) with transaction + locking`
10. `feat(services): deposit service (allocated)`
11. `feat(services): withdrawal service (unallocated) with overdraft check`
12. `feat(services): withdrawal service (allocated) with ownership + status check`
13. `feat(api): deposit + withdrawal route handlers`
14. `feat(api): transactions ledger endpoint with filtering`
15. `feat(ui): app shell, navigation, dashboard skeleton`
16. `feat(ui): customers list + detail`
17. `feat(ui): account detail with portfolio + valuation`
18. `feat(ui): deposit form (both storage types)`
19. `feat(ui): withdrawal form (both storage types)`
20. `feat(ui): transactions history table`
21. `feat(ui): admin pages (prices, bars)`
22. `test: service-layer tests for the 8 edge cases`
23. `docs: architecture diagram + data model walkthrough`
24. `docs: edge cases doc`
25. `docs: README with assumptions, setup, curl examples`
26. `chore: final polish + screenshot for README`

---

## 18. Mapping to Evaluation Criteria

| Rubric criterion           | Where this spec addresses it                                           |
|----------------------------|------------------------------------------------------------------------|
| **Interpretation**         | §4 (domain model) + README's "assumptions and decisions" section       |
| **Design quality**         | §3 (layered architecture) + §5 (schema with single-ledger pattern) + §10 (concurrency) |
| **Reasoning**              | Every section's "why" justifications, especially §4.2 (derive percentage), §4.3 (storage flexibility), §5.9 (single ledger) |
| **Implementation decisions** | §2 (tech stack rationale) + §8 (edge cases) + §11 (error handling)   |
| **Working application**    | §6 + §7 + §16 deliverables checklist                                   |
| **Modern UI**              | §7 (shadcn-based, clear key flows)                                     |
| **Architecture sketch**    | §5.10 Mermaid diagram                                                  |
| **Data model**             | §5 in full                                                             |
| **5+ edge cases**          | §8 documents 8                                                         |
| **Incremental commits**    | §17 commit plan                                                        |
| **README**                 | §15.3 contents list                                                    |

---

**End of spec.**