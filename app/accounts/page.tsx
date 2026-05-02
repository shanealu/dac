import Link from "next/link";
import { listAccounts } from "@/lib/services/account.service";
import { PageHeader } from "@/components/domain/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const accounts = await listAccounts();
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader
        eyebrow="Accounts"
        title="All accounts"
        description={`${accounts.length} account${accounts.length === 1 ? "" : "s"} across all customers.`}
      />

      <Card className="mt-8">
        <CardContent className="p-0">
          {accounts.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No accounts yet. Open a customer page to create one.
            </div>
          ) : (
            <ul className="divide-y">
              {accounts.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/accounts/${a.id}`}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/50"
                  >
                    <div>
                      <div className="font-mono text-sm">{a.accountNumber}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {a.customerName} · {a.customerType}
                      </div>
                    </div>
                    <Badge variant={a.status === "active" ? "default" : "secondary"}>
                      {a.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{fmtDate(a.createdAt)}</span>
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
