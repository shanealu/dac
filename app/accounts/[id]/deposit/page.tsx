import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ArrowDownIcon } from "lucide-react";
import { db } from "@/lib/db/client";
import { metals, vaults } from "@/lib/db/schema";
import { getAccount } from "@/lib/services/account.service";
import { NotFoundError } from "@/lib/errors";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DepositForm } from "@/components/domain/deposit-form";

export const dynamic = "force-dynamic";

export default async function DepositPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let account;
  try {
    account = await getAccount(id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const [metalRows, vaultRows] = await Promise.all([
    db.select().from(metals).all(),
    db.select().from(vaults).all(),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link
          href={`/accounts/${id}`}
          className="flex items-center gap-1 transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3" />
          Back to {account.accountNumber}
        </Link>
      </nav>

      <div className="mb-6 flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-md border bg-card">
          <ArrowDownIcon className="size-4" />
        </span>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Deposit
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Record a new deposit</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="font-mono text-base">{account.accountNumber}</CardTitle>
            <span className="text-muted-foreground">·</span>
            <span className="text-sm">{account.customer.name}</span>
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
              {account.customer.clientType}
            </Badge>
          </div>
          <CardDescription>
            Choose unallocated for pooled storage (kg added to the metal pool) or allocated for a
            specific bar tracked by serial number.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DepositForm accountId={id} metals={metalRows} vaults={vaultRows} />
        </CardContent>
      </Card>
    </div>
  );
}
