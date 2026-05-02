import { desc, eq } from "drizzle-orm";
import { BarChart3Icon, ClockIcon } from "lucide-react";
import { db } from "@/lib/db/client";
import { marketPrices, metals } from "@/lib/db/schema";
import { getCurrentPrices } from "@/lib/services/market-price.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/domain/page-header";
import { PriceUpdateForm } from "@/components/domain/price-update-form";
import { MetalMark } from "@/components/domain/metal-mark";
import { fmtDate, fmtRelative, fmtUSD } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminPricesPage() {
  const PRICE_HISTORY_LIMIT = 25;
  const [metalRows, current, history] = await Promise.all([
    db.select().from(metals).orderBy(metals.code).all(),
    getCurrentPrices(),
    db
      .select({
        id: marketPrices.id,
        metalCode: metals.code,
        metalName: metals.name,
        pricePerKg: marketPrices.pricePerKg,
        currency: marketPrices.currency,
        effectiveAt: marketPrices.effectiveAt,
        source: marketPrices.source,
      })
      .from(marketPrices)
      .innerJoin(metals, eq(metals.id, marketPrices.metalId))
      .orderBy(desc(marketPrices.effectiveAt))
      .limit(PRICE_HISTORY_LIMIT)
      .all(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader
        eyebrow="Admin"
        title="Market prices"
        description="Manually-entered spot prices per metal. Each new price snapshot becomes the active rate for valuations and ledger entries written after it."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-md border bg-muted/40">
                <BarChart3Icon className="size-4" />
              </span>
              <div>
                <CardTitle>Record a new price</CardTitle>
                <CardDescription>
                  Choose a metal and a USD price per kilogram.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <PriceUpdateForm metals={metalRows.map((m) => ({ code: m.code, name: m.name }))} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current prices</CardTitle>
            <CardDescription>Most recent price per metal — drives all valuations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {current.map((p) => (
              <div
                key={p.metalCode}
                className="flex items-center justify-between rounded-md border bg-card/50 p-4"
              >
                <div className="flex items-center gap-3">
                  <MetalMark code={p.metalCode} size="sm" />
                  <div>
                    <div className="font-medium">{p.metalName}</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ClockIcon className="size-3" />
                      {p.effectiveAt ? fmtRelative(p.effectiveAt) : "Never set"}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm tabular-nums">
                    {p.pricePerKg ? fmtUSD(p.pricePerKg) : "—"}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    per kg
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent price history</CardTitle>
          <CardDescription>The last 25 price entries across all metals.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              No price history yet.
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="px-5 py-3 text-left font-semibold">Metal</th>
                    <th className="px-5 py-3 text-right font-semibold">Price/kg</th>
                    <th className="px-5 py-3 text-left font-semibold">Source</th>
                    <th className="px-5 py-3 text-right font-semibold">Effective</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b last:border-b-0 transition-colors hover:bg-muted/20"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <MetalMark code={p.metalCode} size="xs" />
                          <span className="text-sm">{p.metalName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums">
                        {fmtUSD(p.pricePerKg)}
                      </td>
                      <td className="px-5 py-3 text-xs uppercase tracking-wide text-muted-foreground">
                        {p.source}
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-muted-foreground">
                        {fmtDate(p.effectiveAt)}
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
