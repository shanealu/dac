"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { depositSchema, type DepositInput } from "@/lib/validation";
import { ApiError, api } from "@/lib/api/client";

type Vault = { id: number; code: string; name: string };
type Metal = { code: string; name: string };

export function DepositForm({
  accountId,
  metals,
  vaults,
}: {
  accountId: string;
  metals: Metal[];
  vaults: Vault[];
}) {
  const router = useRouter();
  const [storageType, setStorageType] = useState<"unallocated" | "allocated">("unallocated");
  const [pending, setPending] = useState(false);

  const form = useForm<DepositInput>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      storageType: "unallocated",
      accountId,
      metalCode: "XAU" as const,
      vaultId: vaults[0]?.id ?? 1,
      quantityKg: "",
      notes: "",
    } as unknown as DepositInput,
  });

  const onTabChange = (value: string) => {
    const next = value as "unallocated" | "allocated";
    setStorageType(next);
    const reset = (next === "unallocated"
      ? {
          storageType: "unallocated",
          accountId,
          metalCode: "XAU" as const,
          vaultId: vaults[0]?.id ?? 1,
          quantityKg: "",
          notes: "",
        }
      : {
          storageType: "allocated",
          accountId,
          metalCode: "XAU" as const,
          vaultId: vaults[0]?.id ?? 1,
          bar: { serialNumber: "", weightKg: "", purity: "0.9999" },
          notes: "",
        }) as unknown as DepositInput;
    form.reset(reset);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setPending(true);
    try {
      await api("/api/deposits", {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success("Deposit recorded");
      router.push(`/accounts/${accountId}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Deposit failed");
    } finally {
      setPending(false);
    }
  });

  const errors = form.formState.errors;

  return (
    <Tabs value={storageType} onValueChange={onTabChange}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="unallocated">Unallocated (pooled)</TabsTrigger>
        <TabsTrigger value="allocated">Allocated (specific bar)</TabsTrigger>
      </TabsList>

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Metal" error={errors.metalCode?.message}>
            <Controller
              control={form.control}
              name="metalCode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {metals.map((m) => (
                      <SelectItem key={m.code} value={m.code}>
                        {m.name} ({m.code})
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
              name="vaultId"
              render={({ field }) => (
                <Select
                  value={String(field.value)}
                  onValueChange={(v) => field.onChange(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {vaults.map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.code} — {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>

        <TabsContent value="unallocated" className="m-0 space-y-5">
          <Field
            label="Quantity (kg)"
            error={
              storageType === "unallocated"
                ? (errors as { quantityKg?: { message?: string } }).quantityKg?.message
                : undefined
            }
            hint="Decimal allowed. Adds to the pooled balance for this metal."
          >
            <Input
              type="text"
              inputMode="decimal"
              placeholder="10.5000"
              className="font-mono tabular-nums"
              {...form.register("quantityKg")}
            />
          </Field>
        </TabsContent>

        <TabsContent value="allocated" className="m-0 space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Serial number"
              error={(errors as { bar?: { serialNumber?: { message?: string } } }).bar?.serialNumber?.message}
              className="sm:col-span-3"
            >
              <Input
                placeholder="AU-2026-00042"
                className="font-mono tracking-wide"
                {...form.register("bar.serialNumber")}
              />
            </Field>
            <Field
              label="Weight (kg)"
              error={(errors as { bar?: { weightKg?: { message?: string } } }).bar?.weightKg?.message}
            >
              <Input
                type="text"
                inputMode="decimal"
                placeholder="12.4567"
                className="font-mono tabular-nums"
                {...form.register("bar.weightKg")}
              />
            </Field>
            <Field
              label="Purity"
              error={(errors as { bar?: { purity?: { message?: string } } }).bar?.purity?.message}
              hint="e.g., 0.9999"
            >
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.9999"
                className="font-mono tabular-nums"
                {...form.register("bar.purity")}
              />
            </Field>
            <Field label="Suggested" hint="Common defaults" className="text-xs">
              <div className="flex flex-wrap gap-1.5 pt-1">
                {["0.9999", "0.9995", "0.999", "0.995"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="rounded border bg-muted/40 px-2 py-1 font-mono text-[11px] tabular-nums hover:bg-muted"
                    onClick={() => form.setValue("bar.purity", p, { shouldValidate: true })}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </TabsContent>

        <Field label="Notes (optional)" error={errors.notes?.message}>
          <Textarea
            placeholder="e.g., Jan delivery from Bank X"
            rows={2}
            {...form.register("notes")}
          />
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
          <Button type="submit" disabled={pending}>
            {pending ? "Recording…" : "Record deposit"}
          </Button>
        </div>
      </form>
    </Tabs>
  );
}

function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
