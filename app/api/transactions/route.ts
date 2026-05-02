import { and, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { metals, transactions } from "@/lib/db/schema";
import { ok, withErrorHandling } from "@/lib/api/handler";
import { transactionType } from "@/lib/validation";

const querySchema = z.object({
  accountId: z.uuid().optional(),
  type: transactionType.optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(50),
});

export const GET = withErrorHandling(async (req: Request) => {
  const url = new URL(req.url);
  const params = querySchema.parse(Object.fromEntries(url.searchParams));

  const where = and(
    ...[
      params.accountId ? eq(transactions.accountId, params.accountId) : undefined,
      params.type ? eq(transactions.type, params.type) : undefined,
      params.from ? gte(transactions.createdAt, new Date(params.from)) : undefined,
      params.to ? lte(transactions.createdAt, new Date(params.to)) : undefined,
    ].filter((c): c is NonNullable<typeof c> => c !== undefined),
  );

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
    .limit(params.perPage)
    .offset((params.page - 1) * params.perPage)
    .all();

  return ok(rows, {
    headers: { "X-Page": String(params.page), "X-Per-Page": String(params.perPage) },
  });
});
