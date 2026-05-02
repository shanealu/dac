"use client";

import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Field } from "@/components/domain/field";
import { withdrawalSchema, type WithdrawalInput } from "@/lib/validation";
import { ApiError, api } from "@/lib/api/client";
import { fmtKg } from "@/lib/format";

type Vault = { id: number; code: string; name: string };
type Metal = { code: string; name: string };
type UnallocatedHolding = { metalCode: string; metalName: string; quantityKg: string };
type AllocatedBar = {
  barId: string;
  serialNumber: string;
  metalCode: string;
  metalName: string;
  weightKg: string;
  vaultId: number;
};

export function WithdrawalForm({
  accountId,
  metals,
  vaults,
  unallocated,
  allocated,
}: {
  accountId: string;
  metals: Metal[];
  vaults: Vault[];
  unallocated: UnallocatedHolding[];
  allocated: AllocatedBar[];
}) {
  const router = useRouter();
  const [storageType, setStorageType] = useState<"unallocated" | "allocated">(
    unallocated.length > 0 ? "unallocated" : "allocated",
  );
  const [pending, setPending] = useState(false);

  const initialDefaults = (storageType === "unallocated"
    ? {
        storageType: "unallocated",
        accountId,
        metalCode: (unallocated[0]?.metalCode ?? "XAU") as "XAU" | "XAG" | "XPT",
        vaultId: vaults[0]?.id ?? 1,
        quantityKg: "",
        notes: "",
      }
    : {
        storageType: "allocated",
        accountId,
        barId: allocated[0]?.barId ?? "",
        notes: "",
      }) as unknown as WithdrawalInput;

  const form = useForm<WithdrawalInput>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: initialDefaults,
  });

  const watchedMetal = form.watch("metalCode" as never) as unknown as string | undefined;
  const watchedBarId = form.watch("barId" as never) as unknown as string | undefined;

  const balance = useMemo(() => {
    if (storageType !== "unallocated") return null;
    const h = unallocated.find((u) => u.metalCode === watchedMetal);
    return h ? h.quantityKg : "0";
  }, [storageType, unallocated, watchedMetal]);

  const selectedBar = useMemo(() => {
    if (storageType !== "allocated") return null;
    return allocated.find((b) => b.barId === watchedBarId) ?? null;
  }, [storageType, allocated, watchedBarId]);

  const onTabChange = (value: string) => {
    const next = value as "unallocated" | "allocated";
    setStorageType(next);
    const reset = (next === "unallocated"
      ? {
          storageType: "unallocated",
          accountId,
          metalCode: (unallocated[0]?.metalCode ?? "XAU") as "XAU" | "XAG" | "XPT",
          vaultId: vaults[0]?.id ?? 1,
          quantityKg: "",
          notes: "",
        }
      : {
          storageType: "allocated",
          accountId,
          barId: allocated[0]?.barId ?? "",
          notes: "",
        }) as unknown as WithdrawalInput;
    form.reset(reset);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setPending(true);
    try {
      await api("/api/withdrawals", {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success("Withdrawal recorded");
      router.push(`/accounts/${accountId}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Withdrawal failed");
    } finally {
      setPending(false);
    }
  });

  type ErrorShape = {
    metalCode?: { message?: string };
    vaultId?: { message?: string };
    quantityKg?: { message?: string };
    barId?: { message?: string };
    notes?: { message?: string };
  };
  const errors = form.formState.errors as ErrorShape;

  return (
    <Tabs value={storageType} onValueChange={onTabChange}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="unallocated" disabled={unallocated.length === 0}>
          Unallocated ({unallocated.length})
        </TabsTrigger>
        <TabsTrigger value="allocated" disabled={allocated.length === 0}>
          Allocated ({allocated.length})
        </TabsTrigger>
      </TabsList>

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <TabsContent value="unallocated" className="m-0 space-y-5">
          {unallocated.length === 0 ? (
            <EmptyHint>No unallocated balances on this account.</EmptyHint>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Metal" error={errors.metalCode?.message}>
                  <Controller
                    control={form.control}
                    name={"metalCode" as never}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue>
                            {(value: string) => {
                              const h = unallocated.find((u) => u.metalCode === value);
                              return h
                                ? `${h.metalName} — ${fmtKg(h.quantityKg)} available`
                                : <span className="text-muted-foreground">Select a metal</span>;
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {unallocated.map((h) => (
                            <SelectItem key={h.metalCode} value={h.metalCode}>
                              {h.metalName} — {fmtKg(h.quantityKg)} available
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field label="Vault" error={errors.vaultId?.message}>
                  <Controller
                    control={form.control}
                    name={"vaultId" as never}
                    render={({ field }) => (
                      <Select
                        value={String(field.value)}
                        onValueChange={(v) => field.onChange(Number(v))}
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {(value: string) => {
                              const vault = vaults.find((vv) => String(vv.id) === value);
                              return vault?.code ?? <span className="text-muted-foreground">Select a vault</span>;
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {vaults.map((v) => (
                            <SelectItem key={v.id} value={String(v.id)}>
                              {v.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </div>

              <Field
                label="Quantity (kg)"
                error={errors.quantityKg?.message}
                hint={`Available: ${fmtKg(balance ?? "0")}`}
              >
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="2.5000"
                    className="font-mono tabular-nums"
                    {...form.register("quantityKg" as never)}
                  />
                  {balance && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        form.setValue("quantityKg" as never, balance as never, {
                          shouldValidate: true,
                        })
                      }
                    >
                      Max
                    </Button>
                  )}
                </div>
              </Field>
            </>
          )}
        </TabsContent>

        <TabsContent value="allocated" className="m-0 space-y-5">
          {allocated.length === 0 ? (
            <EmptyHint>No allocated bars on this account.</EmptyHint>
          ) : (
            <>
              <Field label="Bar" error={errors.barId?.message}>
                <Controller
                  control={form.control}
                  name={"barId" as never}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue>
                          {(value: string) => {
                            const bar = allocated.find((b) => b.barId === value);
                            return bar
                              ? `${bar.serialNumber} — ${bar.metalName} ${fmtKg(bar.weightKg)}`
                              : <span className="text-muted-foreground">Select a bar</span>;
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {allocated.map((b) => (
                          <SelectItem key={b.barId} value={b.barId}>
                            {b.serialNumber} — {b.metalName} {fmtKg(b.weightKg)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              {selectedBar && (
                <div className="rounded-md border bg-muted/30 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Bar details
                  </div>
                  <div className="mt-2 grid gap-2 text-xs">
                    <Detail label="Serial">{selectedBar.serialNumber}</Detail>
                    <Detail label="Metal">{selectedBar.metalName} ({selectedBar.metalCode})</Detail>
                    <Detail label="Weight">{fmtKg(selectedBar.weightKg)}</Detail>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <Field label="Notes (optional)" error={errors.notes?.message}>
          <Textarea placeholder="Reason / counterparty / instructions" rows={2} {...form.register("notes")} />
        </Field>

        <div className="flex items-center justify-end gap-2 border-t pt-5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(`/accounts/${accountId}`)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="destructive"
            disabled={
              pending ||
              (storageType === "unallocated" && unallocated.length === 0) ||
              (storageType === "allocated" && allocated.length === 0)
            }
          >
            {pending ? "Recording…" : "Record withdrawal"}
          </Button>
        </div>
      </form>
    </Tabs>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground">{children}</span>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}
