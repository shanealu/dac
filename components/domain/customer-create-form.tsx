"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { customerCreateSchema, type CustomerCreateInput } from "@/lib/validation";
import { ApiError, api } from "@/lib/api/client";
import type { Customer } from "@/lib/db/schema";

export function CustomerCreateForm({ onCreated }: { onCreated?: (c: Customer) => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const form = useForm<CustomerCreateInput>({
    resolver: zodResolver(customerCreateSchema),
    defaultValues: { name: "", email: "", phone: "", clientType: "retail" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setPending(true);
    try {
      const created = await api<Customer>("/api/customers", {
        method: "POST",
        body: JSON.stringify({ ...values, phone: values.phone || undefined }),
      });
      toast.success(`Created customer ${created.name}`);
      form.reset();
      onCreated?.(created);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Unexpected error");
    } finally {
      setPending(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" error={form.formState.errors.name?.message}>
        <Input {...form.register("name")} placeholder="Acme Holdings Pvt" />
      </Field>
      <Field label="Email" error={form.formState.errors.email?.message}>
        <Input type="email" {...form.register("email")} placeholder="ops@acme.mv" />
      </Field>
      <Field label="Phone (optional)" error={form.formState.errors.phone?.message}>
        <Input {...form.register("phone")} placeholder="+9607771234" />
      </Field>
      <Field label="Client type" error={form.formState.errors.clientType?.message}>
        <Select
          value={form.watch("clientType")}
          onValueChange={(v) => form.setValue("clientType", v as "retail" | "institutional")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="retail">Retail (unallocated)</SelectItem>
            <SelectItem value="institutional">Institutional (allocated)</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="sm:col-span-2 flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create customer"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
