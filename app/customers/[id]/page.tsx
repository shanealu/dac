import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomer } from "@/lib/services/customer.service";
import { NotFoundError } from "@/lib/errors";
import { PageHeader } from "@/components/domain/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountCreateButton } from "@/components/domain/account-create-button";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let customer;
  try {
    customer = await getCustomer(id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader
        eyebrow={customer.clientType}
        title={customer.name}
        description={customer.email}
        actions={
          <>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/customers" />}>
              ← All customers
            </Button>
            <AccountCreateButton customerId={customer.id} />
          </>
        }
      />

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</div>
            <div className="mt-1 text-sm">{customer.email}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Phone</div>
            <div className="mt-1 text-sm">{customer.phone ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Joined</div>
            <div className="mt-1 text-sm">{fmtDate(customer.createdAt)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>Each account holds a portfolio of allocated bars and unallocated balances.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {customer.accounts.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No accounts yet. Create one to start recording deposits.
            </div>
          ) : (
            <ul className="divide-y">
              {customer.accounts.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/accounts/${a.id}`}
                    className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-muted/50"
                  >
                    <div>
                      <div className="font-mono text-sm">{a.accountNumber}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Opened {fmtDate(a.createdAt)}
                      </div>
                    </div>
                    <Badge variant={a.status === "active" ? "default" : "secondary"}>
                      {a.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
