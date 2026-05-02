import Link from "next/link";
import { ArrowUpRightIcon, BanknoteIcon, CoinsIcon, UsersIcon, WalletIcon } from "lucide-react";
import { db } from "@/lib/db/client";
import { accounts, bars, customers, transactions, unallocatedHoldings } from "@/lib/db/schema";
import { sql, desc, eq } from "drizzle-orm";
import { metals } from "@/lib/db/schema";
import { getCurrentPrices } from "@/lib/services/market-price.service";
import { D, ZERO } from "@/lib/decimal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtKg, fmtUSD } from "@/lib/format";

export const dynamic = "force-dynamic";

async function loadStats() {
  const [{ count: customerCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(customers)
    .all();
  const [{ count: accountCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(accounts)
    .all();
  const [{ count: barCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(bars)
    .where(eq(bars.status, "in_custody"))
    .all();

  const prices = await getCurrentPrices();
  const priceMap = new Map(prices.map((p) => [p.metalId, p.pricePerKg]));

  const unallocatedTotals = await db
    .select({
      metalId: unallocatedHoldings.metalId,
      metalCode: metals.code,
      metalName: metals.name,
      total: sql<string>`SUM(CAST(${unallocatedHoldings.quantityKg} AS REAL))`,
    })
    .from(unallocatedHoldings)
    .innerJoin(metals, eq(metals.id, unallocatedHoldings.metalId))
    .groupBy(unallocatedHoldings.metalId, metals.code, metals.name)
    .all();

  const allocatedTotals = await db
    .select({
      metalId: bars.metalId,
      metalCode: metals.code,
      metalName: metals.name,
      total: sql<string>`SUM(CAST(${bars.weightKg} AS REAL))`,
      bars: sql<number>`COUNT(*)`,
    })
    .from(bars)
    .innerJoin(metals, eq(metals.id, bars.metalId))
    .where(eq(bars.status, "in_custody"))
    .groupBy(bars.metalId, metals.code, metals.name)
    .all();

  // Combine per-metal totals
  type Row = { metalCode: string; metalName: string; quantityKg: string; valueUSD: string | null };
  const rows = new Map<string, Row>();
  for (const u of unallocatedTotals) {
    rows.set(u.metalCode, {
      metalCode: u.metalCode,
      metalName: u.metalName,
      quantityKg: D(u.total ?? 0).toString(),
      valueUSD: null,
    });
  }
  for (const a of allocatedTotals) {
    const existing = rows.get(a.metalCode);
    const qty = D(existing?.quantityKg ?? 0).plus(D(a.total ?? 0));
    rows.set(a.metalCode, {
      metalCode: a.metalCode,
      metalName: a.metalName,
      quantityKg: qty.toString(),
      valueUSD: null,
    });
  }
  let totalUSD = ZERO.plus(0);
  let anyValued = false;
  for (const row of rows.values()) {
    const metal = prices.find((p) => p.metalCode === row.metalCode);
    if (metal?.pricePerKg) {
      row.valueUSD = D(row.quantityKg).times(metal.pricePerKg).toFixed(2);
      totalUSD = totalUSD.plus(D(row.valueUSD));
      anyValued = true;
    }
  }

  const recent = await db
    .select({
      id: transactions.id,
      ref: transactions.referenceNumber,
      type: transactions.type,
      storageType: transactions.storageType,
      quantityKg: transactions.quantityKg,
      metalCode: metals.code,
      createdAt: transactions.createdAt,
      accountNumber: accounts.accountNumber,
      accountId: accounts.id,
    })
    .from(transactions)
    .innerJoin(metals, eq(metals.id, transactions.metalId))
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .orderBy(desc(transactions.createdAt))
    .limit(8)
    .all();

  return {
    customerCount,
    accountCount,
    barCount,
    rows: Array.from(rows.values()).sort((a, b) => a.metalCode.localeCompare(b.metalCode)),
    totalUSD: anyValued ? totalUSD.toFixed(2) : null,
    recent,
    prices,
  };
}

export default async function DashboardPage() {
  const stats = await loadStats();

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Custodial holdings across all customers and vaults.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" render={<Link href="/customers" />}>
            View customers
          </Button>
          <Button size="sm" render={<Link href="/admin/prices" />}>
            Set prices
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total assets under custody"
          value={fmtUSD(stats.totalUSD)}
          hint="Sum of all priced holdings (USD)"
          icon={<BanknoteIcon className="size-5" />}
        />
        <StatCard
          label="Customers"
          value={String(stats.customerCount)}
          hint={`${stats.accountCount} accounts`}
          icon={<UsersIcon className="size-5" />}
        />
        <StatCard
          label="Active bars"
          value={String(stats.barCount)}
          hint="Allocated, in custody"
          icon={<CoinsIcon className="size-5" />}
        />
        <StatCard
          label="Vaults"
          value="2"
          hint="MLE-VAULT-01, MLE-VAULT-02"
          icon={<WalletIcon className="size-5" />}
        />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pooled holdings by metal</CardTitle>
                <CardDescription>Aggregate quantity across allocated bars and unallocated pools.</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-normal">
                Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.rows.length === 0 && (
              <p className="text-sm text-muted-foreground">No deposits yet. Create a customer and record a deposit.</p>
            )}
            {stats.rows.map((row) => (
              <div
                key={row.metalCode}
                className="flex items-center justify-between rounded-lg border bg-card/50 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-md bg-muted font-mono text-xs">
                    {row.metalCode}
                  </span>
                  <div>
                    <div className="font-medium">{row.metalName}</div>
                    <div className="text-xs text-muted-foreground">{fmtKg(row.quantityKg)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-medium">{fmtUSD(row.valueUSD)}</div>
                  <div className="text-xs text-muted-foreground">at current price</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spot prices</CardTitle>
            <CardDescription>Most recent admin-set price per kg.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.prices.map((p) => (
              <div key={p.metalCode} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{p.metalName}</span>
                <span className="font-mono">{p.pricePerKg ? fmtUSD(p.pricePerKg) : "—"}</span>
              </div>
            ))}
            <div className="pt-2 text-xs text-muted-foreground">
              Updated {stats.prices[0]?.effectiveAt ? fmtDate(stats.prices[0].effectiveAt) : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Latest entries on the immutable transaction ledger.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" render={<Link href="/accounts" />}>
              All accounts <ArrowUpRightIcon className="size-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {stats.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Reference</th>
                    <th className="px-4 py-2 text-left font-medium">Account</th>
                    <th className="px-4 py-2 text-left font-medium">Type</th>
                    <th className="px-4 py-2 text-left font-medium">Storage</th>
                    <th className="px-4 py-2 text-left font-medium">Metal</th>
                    <th className="px-4 py-2 text-right font-medium">Quantity</th>
                    <th className="px-4 py-2 text-left font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent.map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="px-4 py-2 font-mono text-xs">{t.ref}</td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/accounts/${t.accountId}`}
                          className="font-mono text-xs underline-offset-2 hover:underline"
                        >
                          {t.accountNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={t.type === "deposit" ? "default" : "secondary"} className="text-xs">
                          {t.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                        {t.storageType}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{t.metalCode}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmtKg(t.quantityKg)}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{fmtDate(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold">{value}</div>
            {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
          </div>
          {icon && <span className="text-muted-foreground">{icon}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
