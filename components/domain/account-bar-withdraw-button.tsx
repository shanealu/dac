"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError, api } from "@/lib/api/client";

export function BarWithdrawButton({
  barId,
  accountId,
  serialNumber,
}: {
  barId: string;
  accountId: string;
  serialNumber: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    try {
      await api("/api/withdrawals", {
        method: "POST",
        body: JSON.stringify({ storageType: "allocated", accountId, barId }),
      });
      toast.success(`Withdrew bar ${serialNumber}`);
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Withdrawal failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Withdraw
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-mono text-base tracking-wide">
              Withdraw bar {serialNumber}?
            </DialogTitle>
            <DialogDescription>
              This is irreversible. The bar will leave custody and be marked as withdrawn in the
              ledger.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={pending}>
              {pending ? "Withdrawing…" : "Confirm withdrawal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
