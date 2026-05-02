import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { metals, transactions } from "@/lib/db/schema";
import { ok, withErrorHandling } from "@/lib/api/handler";

export const GET = withErrorHandling(async (req: Request) => {
  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId");
  const type = url.searchParams.get("type") as "deposit" | "withdrawal" | null;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get("perPage") ?? 50)));

  const filters = [
    accountId ? eq(transactions.accountId, accountId) : undefined,
    type ? eq(transactions.type, type) : undefined,
    from ? gte(transactions.createdAt, new Date(from)) : undefined,
    to ? lte(transactions.createdAt, new Date(to)) : undefined,
  ].filter(Boolean);

  const where = filters.length ? and(...filters) : undefined;

  const rows = await db
    .select({
      id: transactions.id,
      referenceNumber: transactions.referenceNumber,
      accountId: transactions.accountId,
      metalCode: metals.code,
      type: transactions.type,
      storageType: transactions.storageType,
      quantityKg: transactions.quantityKg,
      barId: transactions.barId,
      vaultId: transactions.vaultId,
      pricePerKgAtTime: transactions.pricePerKgAtTime,
      notes: transactions.notes,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(metals, eq(metals.id, transactions.metalId))
    .where(where)
    .orderBy(desc(transactions.createdAt))
    .limit(perPage)
    .offset((page - 1) * perPage)
    .all();

  return ok(rows, { headers: { "X-Page": String(page), "X-Per-Page": String(perPage) } });
});
