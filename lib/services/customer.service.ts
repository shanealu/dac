import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { accounts, customers } from "../db/schema";
import { ConflictError, NotFoundError } from "../errors";
import type { CustomerCreateInput } from "../validation";

export async function createCustomer(input: CustomerCreateInput) {
  try {
    const [created] = await db.insert(customers).values(input).returning();
    return created;
  } catch (err) {
    if (err instanceof Error && /UNIQUE.*email/i.test(err.message)) {
      throw new ConflictError(`A customer with email "${input.email}" already exists`, {
        email: input.email,
      });
    }
    throw err;
  }
}

export async function listCustomers() {
  return db.select().from(customers).orderBy(customers.createdAt).all();
}

export async function getCustomer(id: string) {
  const customer = await db.select().from(customers).where(eq(customers.id, id)).get();
  if (!customer) throw new NotFoundError("Customer", id);
  const customerAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.customerId, id))
    .orderBy(accounts.createdAt)
    .all();
  return { ...customer, accounts: customerAccounts };
}
