import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  BoxIcon,
  BuildingIcon,
  ClockIcon,
  CoinsIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { metals, unallocatedHoldings, vaults } from "@/lib/db/schema";
import { getAccount } from "@/lib/services/account.service";
import { NotFoundError } from "@/lib/errors";
import { fmtDate, fmtKg, fmtPct, fmtRelative, fmtUSD } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarWithdrawButton } from "@/components/domain/account-bar-withdraw-button";

export const dynamic = "force-dynamic";

type AccountView = Awaited<ReturnType<typeof getAccount>>;
type Holding = AccountView["holdings"]["unallocated"][number];
type AllocatedBar = AccountView["holdings"]["allocated"][number];
type LedgerEntry = AccountView["recentTransactions"][number];
type Valuation = AccountView["valuation"];
type ValuationMetal = Valuation["perMetal"][number];
type VaultRow = typeof vaults.$inferSelect;

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let account: AccountView;
  try {
    account = await getAccount(id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const vaultRows = await db.select().from(vaults).all();
  const vaultById = new Map<number, VaultRow>(vaultRows.map((v) => [v.id, v]));

  const poolTotalsRows = await db
    .select({
      metalCode: metals.code,
      total: sql<string>`SUM(CAST(${unallocatedHoldings.quantityKg} AS REAL))`,
    })
    .from(unallocatedHoldings)
    .innerJoin(metals, eq(metals.id, unallocatedHoldings.metalId))
    .groupBy(unallocatedHoldings.metalId, metals.code)
    .all();
  const poolByCode = new Map<string, string>(
    poolTotalsRows.map((p) => [p.metalCode, p.total ?? "0"]),
  );

  const txCount = account.recentTransactions.length;
  const allocatedCount = account.holdings.allocated.length;
  const unallocatedCount = account.holdings.unallocated.length;

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/accounts" className="flex items-center gap-1 transition-colors hover:text-foreground">
          <ArrowLeftIcon className="size-3" />
          Accounts
        </Link>
        <span>/</span>
        <Link
          href={`/customers/${account.customer.id}`}
          className="transition-colors hover:text-foreground"
        >
          {account.customer.name}
        </Link>
        <span>/</span>
        <span className="font-mono text-foreground">{account.accountNumber}</span>
      </nav>

      {/* Hero — vault-paperwork feel */}
      <section className="border-y bg-card">
        <div className="grid grid-cols-1 gap-10 px-6 py-10 sm:px-8 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <div className="space-y-6">
            <div>
              <StatLabel>Account</StatLabel>
              <div className="mt-1.5 font-mono text-2xl tracking-tight tabular-nums">
                {account.accountNumber}
              </div>
            </div>
            <div>
              <StatLabel>Customer</StatLabel>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="text-base font-medium">{account.customer.name}</span>
                <Badge
                  variant={account.customer.clientType === "institutional" ? "default" : "secondary"}
                  className="text-[10px] uppercase tracking-wider"
                >
                  {account.customer.clientType}
                </Badge>
                <Badge variant="outline" className="gap-1 text-[10px] uppercase tracking-wider">
                  <ShieldCheckIcon className="size-3" />
                  {account.status}
                </Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{account.customer.email}</div>
            </div>
            <div className="text-xs text-muted-foreground">
              Opened {fmtDate(account.createdAt)}
            </div>
          </div>

          <div className="flex flex-col items-start justify-between gap-6 lg:items-end">
            <div className="lg:text-right">
              <StatLabel>Total value (USD)</StatLabel>
              <div className="mt-2 font-mono text-5xl font-medium tracking-tight tabular-nums sm:text-6xl">
                {account.valuation.totalUSD ? fmtUSD(account.valuation.totalUSD) : "—"}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground lg:justify-end">
                <ClockIcon className="size-3" />
                As of {fmtRelative(account.valuation.asOf)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                nativeButton={false} render={<Link href={`/accounts/${id}/withdraw`} />}
              >
                <ArrowUpIcon className="size-3.5" />
                Withdraw
              </Button>
              <Button nativeButton={false} render={<Link href={`/accounts/${id}/deposit`} />}>
                <ArrowDownIcon className="size-3.5" />
                Deposit
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Per-metal valuation cards */}
      <section className="mt-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {account.valuation.perMetal.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground md:col-span-3">
              No holdings on this account yet — record a deposit to begin.
            </div>
          ) : (
            account.valuation.perMetal.map((m) => <MetalCard key={m.metalCode} metal={m} />)
          )}
        </div>
      </section>

      {/* Tabs */}
      <section className="mt-12">
        <Tabs defaultValue="unallocated" className="w-full">
          <TabsList className="h-auto w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabTrigger value="unallocated" count={unallocatedCount}>Unallocated</TabTrigger>
            <TabTrigger value="allocated" count={allocatedCount}>Allocated</TabTrigger>
            <TabTrigger value="transactions" count={txCount}>Transactions</TabTrigger>
          </TabsList>

          <TabsContent value="unallocated" className="mt-6">
            <UnallocatedTab
              holdings={account.holdings.unallocated}
              poolByCode={poolByCode}
              valuation={account.valuation}
            />
          </TabsContent>
          <TabsContent value="allocated" className="mt-6">
            <AllocatedTab bars={account.holdings.allocated} vaultById={vaultById} accountId={id} />
          </TabsContent>
          <TabsContent value="transactions" className="mt-6">
            <TransactionsTab transactions={account.recentTransactions} />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}

function StatLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </div>
  );
}

function TabTrigger({
  value,
  count,
  children,
}: {
  value: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <TabsTrigger
      value={value}
      className="relative h-10 gap-2 rounded-none border-b-2 border-transparent px-4 text-sm font-medium text-muted-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground"
    >
      {children}
      <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] tabular-nums">
        {count}
      </span>
    </TabsTrigger>
  );
}

function MetalMark({ code }: { code: string }) {
  return (
    <div className="grid size-10 place-items-center rounded-md border bg-muted/40 font-mono text-[11px] font-semibold tracking-wider">
      {code}
    </div>
  );
}

function MetalCard({ metal }: { metal: ValuationMetal }) {
  const unpriced = metal.pricePerKg === null;
  return (
    <div className="group relative overflow-hidden rounded-lg border bg-card transition-colors hover:border-foreground/30">
      <div className="absolute right-0 top-0 size-20 bg-gradient-to-bl from-muted/30 to-transparent" />
      <div className="relative p-5">
        <div className="flex items-start justify-between">
          <MetalMark code={metal.metalCode} />
          {unpriced && (
            <span className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Unpriced
            </span>
          )}
        </div>
        <div className="mt-5 space-y-1">
          <StatLabel>{metal.metalName}</StatLabel>
          <div className="font-mono text-2xl font-medium tabular-nums tracking-tight">
            {fmtKg(metal.quantityKg)}
          </div>
          <div className="font-mono text-sm tabular-nums text-muted-foreground">
            {unpriced ? "Set price to value" : fmtUSD(metal.valueUSD)}
          </div>
        </div>
      </div>
    </div>
  );
}

function UnallocatedTab({
  holdings,
  poolByCode,
  valuation,
}: {
  holdings: Holding[];
  poolByCode: Map<string, string>;
  valuation: Valuation;
}) {
  if (holdings.length === 0) {
    return (
      <EmptyState
        icon={<CoinsIcon className="size-6" />}
        title="No unallocated holdings"
        hint="Deposits to unallocated storage join a pooled balance for that metal — the customer holds a percentage share of the pool."
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <th className="px-5 py-3 text-left font-semibold">Metal</th>
            <th className="px-5 py-3 text-right font-semibold">Held</th>
            <th className="px-5 py-3 text-right font-semibold">Pool share</th>
            <th className="px-5 py-3 text-right font-semibold">Value (USD)</th>
            <th className="px-5 py-3 text-right font-semibold">Last update</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const pool = poolByCode.get(h.metalCode) ?? "0";
            const valEntry = valuation.perMetal.find((v) => v.metalCode === h.metalCode);
            return (
              <tr
                key={h.holdingId}
                className="border-b transition-colors last:border-b-0 hover:bg-muted/20"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <MetalMark code={h.metalCode} />
                    <div>
                      <div className="font-medium">{h.metalName}</div>
                      <div className="text-xs text-muted-foreground">Pooled storage</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-right font-mono tabular-nums">
                  {fmtKg(h.quantityKg)}
                </td>
                <td className="px-5 py-4 text-right font-mono tabular-nums text-muted-foreground">
                  {fmtPct(h.quantityKg, pool)}
                </td>
                <td className="px-5 py-4 text-right font-mono tabular-nums">
                  {valEntry?.valueUSD ? (
                    fmtUSD(valEntry.valueUSD)
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-5 py-4 text-right text-xs text-muted-foreground">
                  {fmtRelative(h.updatedAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AllocatedTab({
  bars,
  vaultById,
  accountId,
}: {
  bars: AllocatedBar[];
  vaultById: Map<number, VaultRow>;
  accountId: string;
}) {
  if (bars.length === 0) {
    return (
      <EmptyState
        icon={<BoxIcon className="size-6" />}
        title="No allocated bars"
        hint="Each deposit creates a uniquely-serialised bar tracked in the ledger by serial number, weight, and purity."
      />
    );
  }
  return (
    <div className="space-y-2">
      {bars.map((bar) => {
        const vault = vaultById.get(bar.vaultId);
        return (
          <article
            key={bar.barId}
            className="grid grid-cols-1 items-center gap-5 rounded-lg border bg-card px-5 py-4 transition-colors hover:border-foreground/30 sm:grid-cols-[auto_1fr_auto] sm:gap-8"
          >
            <div className="flex items-center gap-4">
              <MetalMark code={bar.metalCode} />
              <div className="min-w-0">
                <div className="font-mono text-sm font-medium tracking-wide">
                  {bar.serialNumber}
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {bar.metalName} · Deposited {fmtDate(bar.createdAt)}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-right">
              <div>
                <StatLabel>Weight</StatLabel>
                <div className="mt-1 font-mono text-sm tabular-nums">{fmtKg(bar.weightKg)}</div>
              </div>
              <div>
                <StatLabel>Purity</StatLabel>
                <div className="mt-1 font-mono text-sm tabular-nums">
                  {Number(bar.purity).toFixed(4)}
                </div>
              </div>
              <div>
                <StatLabel>Vault</StatLabel>
                <div className="mt-1 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                  <BuildingIcon className="size-3" />
                  <span className="font-mono">{vault?.code ?? `V-${bar.vaultId}`}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <BarWithdrawButton
                barId={bar.barId}
                accountId={accountId}
                serialNumber={bar.serialNumber}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function TransactionsTab({ transactions }: { transactions: LedgerEntry[] }) {
  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={<ClockIcon className="size-6" />}
        title="No transactions yet"
        hint="Deposits and withdrawals will appear on the immutable ledger in chronological order."
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <th className="px-5 py-3 text-left font-semibold">Reference</th>
            <th className="px-5 py-3 text-left font-semibold">Type</th>
            <th className="px-5 py-3 text-left font-semibold">Metal</th>
            <th className="px-5 py-3 text-right font-semibold">Quantity</th>
            <th className="px-5 py-3 text-right font-semibold">Price/kg at time</th>
            <th className="px-5 py-3 text-right font-semibold">When</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => {
            const isDeposit = t.type === "deposit";
            return (
              <tr
                key={t.id}
                className="border-b transition-colors last:border-b-0 hover:bg-muted/20"
              >
                <td className="px-5 py-3 font-mono text-xs">{t.referenceNumber}</td>
                <td className="px-5 py-3">
                  <div className="inline-flex items-center gap-1.5 text-xs">
                    {isDeposit ? (
                      <ArrowDownIcon className="size-3 text-foreground" />
                    ) : (
                      <ArrowUpIcon className="size-3 text-muted-foreground" />
                    )}
                    <span className={isDeposit ? "font-medium" : "text-muted-foreground"}>
                      {t.type}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t.storageType}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3 font-mono text-xs">{t.metalCode}</td>
                <td className="px-5 py-3 text-right font-mono tabular-nums">
                  {fmtKg(t.quantityKg)}
                </td>
                <td className="px-5 py-3 text-right font-mono tabular-nums text-muted-foreground">
                  {t.pricePerKgAtTime ? fmtUSD(t.pricePerKgAtTime) : <span>—</span>}
                </td>
                <td className="px-5 py-3 text-right text-xs text-muted-foreground">
                  {fmtDate(t.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 px-6 py-16 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted/40 text-muted-foreground">
        {icon}
      </div>
      <div className="mt-4 text-sm font-medium">{title}</div>
      <div className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}
