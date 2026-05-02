"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/domain/field";
import { marketPriceCreateSchema, type MarketPriceCreateInput } from "@/lib/validation";
import { ApiError, api } from "@/lib/api/client";

export function PriceUpdateForm({ metals }: { metals: { code: string; name: string }[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const form = useForm<MarketPriceCreateInput>({
    resolver: zodResolver(marketPriceCreateSchema),
    defaultValues: { metalCode: "XAU", pricePerKg: "", currency: "USD" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setPending(true);
    try {
      await api("/api/market-prices", {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success(`Price for ${values.metalCode} updated`);
      form.reset({ metalCode: values.metalCode, pricePerKg: "", currency: "USD" });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update price");
    } finally {
      setPending(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <Field label="Metal" error={form.formState.errors.metalCode?.message}>
          <Controller
            control={form.control}
            name="metalCode"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue>
                    {(value: string) => {
                      const m = metals.find((mm) => mm.code === value);
                      return m ? `${m.name} (${m.code})` : value;
                    }}
                  </SelectValue>
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
        <Field
          label="Price per kg (USD)"
          error={form.formState.errors.pricePerKg?.message}
          hint="Highest precision; will snapshot to ledger entries created after this point."
        >
          <Input
            inputMode="decimal"
            placeholder="65000.00"
            className="font-mono tabular-nums"
            {...form.register("pricePerKg")}
          />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Recording…" : "Record price"}
        </Button>
      </div>
    </form>
  );
}

