"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api/client";

export function AccountCreateButton({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const created = await api<{ id: string; accountNumber: string }>("/api/accounts", {
            method: "POST",
            body: JSON.stringify({ customerId }),
          });
          toast.success(`Created ${created.accountNumber}`);
          router.refresh();
          router.push(`/accounts/${created.id}`);
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Failed to create account");
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? "Creating…" : "+ New account"}
    </Button>
  );
}
