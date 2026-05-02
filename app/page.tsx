import Link from "next/link";
import { ArrowUpRightIcon, BanknoteIcon, CoinsIcon, UsersIcon, WalletIcon } from "lucide-react";
import { db } from "@/lib/db/client";
import { accounts, bars, customers, transactions, unallocatedHoldings } from "@/lib/db/schema";
import { sql, desc, eq } from "drizzle-orm";
import { metals } from "@/lib/db/schema";
import { getCurrentPrices, getPriceSnapshots } from "@/lib/services/market-price.service";
import type { PriceSnapshot } from "@/lib/services/market-price.service";
import { D } from "@/lib/decimal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetalMark } from "@/components/domain/metal-mark";
import { Sparkline } from "@/components/domain/sparkline";
import { StatLabel } from "@/components/domain/stat-label";
import { fmtDate, fmtKg, fmtRelative, fmtUSD } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RECENT_TX_LIMIT = 8;

async function loadStats() {
  const [
    [customerCountRow],
    [accountCountRow],
    [barCountRow],
    prices,
    snapshots,
    unallocatedTotals,
    allocatedTotals,
    recent,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(customers).all(),
    db.select({ count: sql<number>`count(*)` }).from(accounts).all(),
    db
      .select({ count: sql<number>`count(*)` })
      .from(bars)
      .where(eq(bars.status, "in_custody"))
      .all(),
    getCurrentPrices(),
    getPriceSnapshots(12),
    db
      .select({
        metalCode: metals.code,
        metalName: metals.name,
        total: sql<string>`SUM(CAST(${unallocatedHoldings.quantityKg} AS REAL))`,
      })
      .from(unallocatedHoldings)
      .innerJoin(metals, eq(metals.id, unallocatedHoldings.metalId))
      .groupBy(unallocatedHoldings.metalId, metals.code, metals.name)
      .all(),
    db
      .select({
        metalCode: metals.code,
        metalName: metals.name,
        total: sql<string>`SUM(CAST(${bars.weightKg} AS REAL))`,
      })
      .from(bars)
      .innerJoin(metals, eq(metals.id, bars.metalId))
      .where(eq(bars.status, "in_custody"))
      .groupBy(bars.metalId, metals.code, metals.name)
      .all(),
    db
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
      .limit(RECENT_TX_LIMIT)
      .all(),
  ]);

  type Row = { metalCode: string; metalName: string; quantityKg: string; valueUSD: string | null };
  const rows = new Map<string, Row>();
  const upsert = (code: string, name: string, qty: string) => {
    const existing = rows.get(code);
    const newQty = D(existing?.quantityKg ?? 0).plus(D(qty ?? 0));
    rows.set(code, {
      metalCode: code,
      metalName: name,
      quantityKg: newQty.toString(),
      valueUSD: null,
    });
  };
  for (const u of unallocatedTotals) upsert(u.metalCode, u.metalName, u.total ?? "0");
  for (const a of allocatedTotals) upsert(a.metalCode, a.metalName, a.total ?? "0");

  let totalUSD = D(0);
  let anyValued = false;
  for (const row of rows.values()) {
    const price = prices.find((p) => p.metalCode === row.metalCode)?.pricePerKg;
    if (price) {
      row.valueUSD = D(row.quantityKg).times(price).toFixed(2);
      totalUSD = totalUSD.plus(D(row.valueUSD));
      anyValued = true;
    }
  }

  return {
    customerCount: customerCountRow.count,
    accountCount: accountCountRow.count,
    barCount: barCountRow.count,
    rows: Array.from(rows.values()).sort((a, b) => a.metalCode.localeCompare(b.metalCode)),
    totalUSD: anyValued ? totalUSD.toFixed(2) : null,
    recent,
    prices,
    snapshots,
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
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/customers" />}>
            View customers
          </Button>
          <Button size="sm" nativeButton={false} render={<Link href="/admin/prices" />}>
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
                  <MetalMark code={row.metalCode} size="sm" />
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

        <SpotPricesCard snapshots={stats.snapshots} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Latest entries on the immutable transaction ledger.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/accounts" />}>
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
            <StatLabel>{label}</StatLabel>
            <div className="mt-2 font-mono text-2xl font-semibold">{value}</div>
            {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
          </div>
          {icon && <span className="text-muted-foreground">{icon}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function computeDelta(snapshot: PriceSnapshot): {
  pct: number | null;
  direction: "up" | "down" | "flat" | null;
} {
  if (!snapshot.pricePerKg || !snapshot.previousPricePerKg) {
    return { pct: null, direction: null };
  }
  const latest = D(snapshot.pricePerKg);
  const prev = D(snapshot.previousPricePerKg);
  if (prev.isZero()) return { pct: null, direction: null };
  const pct = latest.minus(prev).div(prev).times(100).toNumber();
  if (Math.abs(pct) < 0.005) return { pct: 0, direction: "flat" };
  return { pct, direction: pct > 0 ? "up" : "down" };
}

function SpotPricesCard({ snapshots }: { snapshots: PriceSnapshot[] }) {
  const mostRecent = snapshots
    .map((s) => s.effectiveAt?.getTime() ?? 0)
    .reduce((a, b) => Math.max(a, b), 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <CardTitle>Spot prices</CardTitle>
          <span className="rounded-sm border bg-muted/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            USD / kg
          </span>
        </div>
        <CardDescription>Latest admin-set rates with recent trend.</CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="divide-y border-t">
          {snapshots.map((s) => {
            const delta = computeDelta(s);
            const sparkColor =
              delta.direction === "up"
                ? "text-emerald-500/80"
                : delta.direction === "down"
                  ? "text-rose-500/80"
                  : "text-foreground/40";
            return (
              <div
                key={s.metalCode}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-6 py-3.5"
              >
                <MetalMark code={s.metalCode} size="sm" />

                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {s.metalCode}
                    </span>
                    <span className="truncate text-sm">{s.metalName}</span>
                  </div>
                  <div className={cn("mt-1.5 -ml-px", sparkColor)}>
                    <Sparkline values={s.trend} width={96} height={18} />
                  </div>
                </div>

                <div className="flex flex-col items-end gap-0.5">
                  <div className="font-mono text-sm font-medium tabular-nums">
                    {s.pricePerKg ? fmtUSD(s.pricePerKg) : <span className="text-muted-foreground">—</span>}
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[10px] tabular-nums">
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5",
                        delta.direction === "up" && "text-emerald-500/90",
                        delta.direction === "down" && "text-rose-500/90",
                        (delta.direction === "flat" || delta.direction === null) &&
                          "text-muted-foreground",
                      )}
                    >
                      {delta.direction === "up" && <span aria-hidden>▲</span>}
                      {delta.direction === "down" && <span aria-hidden>▼</span>}
                      {delta.direction === "flat" && <span aria-hidden>·</span>}
                      {delta.direction === null && <span aria-hidden>·</span>}
                      {delta.pct === null ? "—" : `${Math.abs(delta.pct).toFixed(2)}%`}
                    </span>
                    <span className="text-muted-foreground/50">·</span>
                    <span className="text-muted-foreground">
                      {s.effectiveAt ? fmtRelative(s.effectiveAt) : "—"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t bg-muted/20 px-6 py-2.5 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
          <span>Source · Manual</span>
          <span>Last tick {mostRecent ? fmtRelative(new Date(mostRecent)) : "—"}</span>
        </div>
      </CardContent>
    </Card>
  );
}
