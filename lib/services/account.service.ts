import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import {
  accounts,
  bars,
  customers,
  metals,
  transactions,
  unallocatedHoldings,
} from "../db/schema";
import { NotFoundError } from "../errors";
import { nextReference } from "./reference";
import { valuateAccount } from "./valuation.service";
import type { AccountCreateInput } from "../validation";

export async function createAccount(input: AccountCreateInput) {
  const customer = await db
    .select()
    .from(customers)
    .where(eq(customers.id, input.customerId))
    .get();
  if (!customer) throw new NotFoundError("Customer", input.customerId);

  return db.transaction((tx) => {
    const accountNumber = nextReference(tx, "ACC");
    const [created] = tx
      .insert(accounts)
      .values({ customerId: input.customerId, accountNumber })
      .returning()
      .all();
    return created;
  });
}

export async function listAccounts() {
  return db
    .select({
      id: accounts.id,
      accountNumber: accounts.accountNumber,
      status: accounts.status,
      createdAt: accounts.createdAt,
      customerId: customers.id,
      customerName: customers.name,
      customerType: customers.clientType,
    })
    .from(accounts)
    .innerJoin(customers, eq(customers.id, accounts.customerId))
    .orderBy(accounts.createdAt)
    .all();
}

export async function getAccount(id: string) {
  const row = await db
    .select({
      account: accounts,
      customer: customers,
    })
    .from(accounts)
    .innerJoin(customers, eq(customers.id, accounts.customerId))
    .where(eq(accounts.id, id))
    .get();
  if (!row) throw new NotFoundError("Account", id);

  const unallocated = await db
    .select({
      holdingId: unallocatedHoldings.id,
      metalId: metals.id,
      metalCode: metals.code,
      metalName: metals.name,
      quantityKg: unallocatedHoldings.quantityKg,
      updatedAt: unallocatedHoldings.updatedAt,
    })
    .from(unallocatedHoldings)
    .innerJoin(metals, eq(metals.id, unallocatedHoldings.metalId))
    .where(eq(unallocatedHoldings.accountId, id))
    .all();

  const allocated = await db
    .select({
      barId: bars.id,
      serialNumber: bars.serialNumber,
      metalCode: metals.code,
      metalName: metals.name,
      weightKg: bars.weightKg,
      purity: bars.purity,
      vaultId: bars.vaultId,
      status: bars.status,
      createdAt: bars.createdAt,
    })
    .from(bars)
    .innerJoin(metals, eq(metals.id, bars.metalId))
    .where(and(eq(bars.currentAccountId, id), eq(bars.status, "in_custody")))
    .all();

  const recentTransactions = await db
    .select({
      id: transactions.id,
      referenceNumber: transactions.referenceNumber,
      type: transactions.type,
      storageType: transactions.storageType,
      metalCode: metals.code,
      quantityKg: transactions.quantityKg,
      barId: transactions.barId,
      pricePerKgAtTime: transactions.pricePerKgAtTime,
      createdAt: transactions.createdAt,
      notes: transactions.notes,
    })
    .from(transactions)
    .innerJoin(metals, eq(metals.id, transactions.metalId))
    .where(eq(transactions.accountId, id))
    .orderBy(desc(transactions.createdAt))
    .limit(50)
    .all();

  const valuation = await valuateAccount({
    unallocated: unallocated.map((u) => ({ metalId: u.metalId, quantityKg: u.quantityKg })),
    allocated: allocated.map((b) => ({ metalCode: b.metalCode, weightKg: b.weightKg })),
  });

  return {
    ...row.account,
    customer: row.customer,
    holdings: { unallocated, allocated },
    recentTransactions,
    valuation,
  };
}
