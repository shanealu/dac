import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ArrowUpIcon } from "lucide-react";
import { db } from "@/lib/db/client";
import { metals, vaults } from "@/lib/db/schema";
import { getAccount } from "@/lib/services/account.service";
import { NotFoundError } from "@/lib/errors";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WithdrawalForm } from "@/components/domain/withdrawal-form";

export const dynamic = "force-dynamic";

export default async function WithdrawPage({ params }: { params: Promise<{ id: string }> }) {
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
          <ArrowUpIcon className="size-4" />
        </span>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Withdrawal
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Record a withdrawal</h1>
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
            Withdrawals are written to the immutable ledger. Allocated bars are marked withdrawn;
            unallocated quantities are deducted from the customer's pooled balance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WithdrawalForm
            accountId={id}
            metals={metalRows}
            vaults={vaultRows}
            unallocated={account.holdings.unallocated.map((u) => ({
              metalCode: u.metalCode,
              metalName: u.metalName,
              quantityKg: u.quantityKg,
            }))}
            allocated={account.holdings.allocated.map((b) => ({
              barId: b.barId,
              serialNumber: b.serialNumber,
              metalCode: b.metalCode,
              metalName: b.metalName,
              weightKg: b.weightKg,
              vaultId: b.vaultId,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
