import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { ScaleIcon, ShieldCheckIcon } from "lucide-react";
import { db } from "@/lib/db/client";
import { accounts, bars, customers, metals, vaults } from "@/lib/db/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/domain/page-header";
import { MetalMark } from "@/components/domain/metal-mark";
import { StatLabel } from "@/components/domain/stat-label";
import { fmtDate, fmtKg, fmtPurity } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminBarsPage() {
  const rows = await db
    .select({
      id: bars.id,
      serialNumber: bars.serialNumber,
      metalCode: metals.code,
      metalName: metals.name,
      weightKg: bars.weightKg,
      purity: bars.purity,
      vaultCode: vaults.code,
      status: bars.status,
      createdAt: bars.createdAt,
      currentAccountId: bars.currentAccountId,
      accountNumber: accounts.accountNumber,
      customerName: customers.name,
    })
    .from(bars)
    .innerJoin(metals, eq(metals.id, bars.metalId))
    .innerJoin(vaults, eq(vaults.id, bars.vaultId))
    .leftJoin(accounts, eq(accounts.id, bars.currentAccountId))
    .leftJoin(customers, eq(customers.id, accounts.customerId))
    .orderBy(desc(bars.createdAt))
    .all();

  const inCustody = rows.filter((r) => r.status === "in_custody").length;
  const withdrawn = rows.length - inCustody;

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        eyebrow="Admin"
        title="Allocated bars registry"
        description="Every individually-tracked bar in custody, including its serial number, weight, purity, vault, and current owner."
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Total bars on file" value={String(rows.length)} icon={<ScaleIcon className="size-4" />} />
        <Stat label="In custody" value={String(inCustody)} icon={<ShieldCheckIcon className="size-4" />} />
        <Stat label="Withdrawn" value={String(withdrawn)} muted icon={<ScaleIcon className="size-4" />} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>All bars</CardTitle>
          <CardDescription>
            Withdrawn bars remain on file for audit; their owner reference is cleared at withdrawal.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              No bars on file. Allocated deposits will appear here.
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="px-5 py-3 text-left font-semibold">Serial</th>
                    <th className="px-5 py-3 text-left font-semibold">Metal</th>
                    <th className="px-5 py-3 text-right font-semibold">Weight</th>
                    <th className="px-5 py-3 text-right font-semibold">Purity</th>
                    <th className="px-5 py-3 text-left font-semibold">Vault</th>
                    <th className="px-5 py-3 text-left font-semibold">Holder</th>
                    <th className="px-5 py-3 text-right font-semibold">Status</th>
                    <th className="px-5 py-3 text-right font-semibold">Deposited</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b transition-colors last:border-b-0 hover:bg-muted/20">
                      <td className="px-5 py-3 font-mono text-xs tracking-wide">{r.serialNumber}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <MetalMark code={r.metalCode} size="xs" />
                          <span className="text-sm">{r.metalName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums">{fmtKg(r.weightKg)}</td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums">
                        {fmtPurity(r.purity)}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs">{r.vaultCode}</td>
                      <td className="px-5 py-3">
                        {r.accountNumber ? (
                          <Link
                            href={`/accounts/${r.currentAccountId}`}
                            className="group inline-flex flex-col text-xs"
                          >
                            <span className="font-mono text-foreground group-hover:underline">
                              {r.accountNumber}
                            </span>
                            <span className="text-muted-foreground">{r.customerName}</span>
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Badge variant={r.status === "in_custody" ? "default" : "secondary"} className="text-[10px] uppercase tracking-wider">
                          {r.status === "in_custody" ? "In custody" : "Withdrawn"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-muted-foreground">
                        {fmtDate(r.createdAt)}
                      </td>
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

function Stat({
  label,
  value,
  icon,
  muted,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <StatLabel>{label}</StatLabel>
            <div
              className={`mt-2 font-mono text-3xl tabular-nums tracking-tight${
                muted ? " text-muted-foreground" : ""
              }`}
            >
              {value}
            </div>
          </div>
          {icon && <span className="text-muted-foreground">{icon}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
