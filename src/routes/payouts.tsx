import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PaySheet } from "@/components/finance/pay-sheet";
import { useFinance } from "@/lib/finance/store";
import { inr, shortDate } from "@/lib/finance/format";
import { maskVpa } from "@/lib/finance/upi";
import type { PayoutStatus } from "@/lib/finance/types";

export const Route = createFileRoute("/payouts")({ component: PayoutsPage });

function tone(s: PayoutStatus) {
  if (s === "paid") return "ok" as const;
  if (s === "failed") return "danger" as const;
  return "warn" as const;
}

function PayoutsPage() {
  const month = useFinance((s) => s.month);
  const drivers = useFinance((s) => s.drivers);
  const payouts = useFinance((s) => s.payouts);
  const setStatus = useFinance((s) => s.setPayoutStatus);
  const [payOpen, setPayOpen] = useState(false);
  const [payId, setPayId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | PayoutStatus>("all");

  const rows = useMemo(() => {
    return payouts
      .filter((p) => p.date.startsWith(month))
      .filter((p) => (filter === "all" ? true : p.status === filter));
  }, [payouts, month, filter]);

  const missing = drivers.filter((d) => d.active && !d.upiVpa);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Payouts</h1>
          <p className="mt-1 max-w-lg text-sm text-muted">
            Confirm after the money leaves. Opening PhonePe or Paytm does not mark a payout paid.
          </p>
        </div>
        <Button
          onClick={() => {
            setPayId(null);
            setPayOpen(true);
          }}
        >
          <Wallet /> New payout
        </Button>
      </div>

      {missing.length > 0 ? (
        <Card className="border-warn/25 bg-warn-soft p-4">
          <div className="text-sm font-medium text-warn">Cannot pay until UPI is on file</div>
          <p className="mt-1 text-[13px] text-warn/90">
            {missing.map((d) => d.name).join(", ")} — tap Pay, enter the UPI ID on the form, and save it to the driver.
            That was the old bug: IDs lived only in this phone’s browser storage.
          </p>
        </Card>
      ) : null}

      <div className="flex gap-2">
        {(["all", "pending", "paid", "failed"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`h-9 rounded-md px-3 text-[13px] font-medium capitalize ${
              filter === f ? "bg-navy text-navy-fg" : "border border-line bg-raised text-muted"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {rows.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">No payouts in this filter.</p>
          </Card>
        ) : (
          rows.map((p) => {
            const d = drivers.find((x) => x.id === p.driverId);
            return (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{d?.name || "Driver"}</span>
                      <Badge tone="muted" className="capitalize">
                        {p.kind.replace("_", " ")}
                      </Badge>
                      <Badge tone={tone(p.status)} className="capitalize">
                        {p.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[12px] text-muted">
                      {shortDate(p.date)} · {p.mode.toUpperCase()}
                      {p.upiVpa ? ` · ${maskVpa(p.upiVpa)}` : ""}
                    </p>
                    {p.note ? <p className="mt-1 text-[12px] text-subtle">{p.note}</p> : null}
                  </div>
                  <div className="text-right font-display text-xl font-medium tabular-nums">{inr(p.amount)}</div>
                </div>
                {p.status === "pending" ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setStatus(p.id, "failed");
                        toast.message("Marked failed");
                      }}
                    >
                      Failed
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setStatus(p.id, "paid");
                        toast.success("Marked paid");
                      }}
                    >
                      Confirm paid
                    </Button>
                  </div>
                ) : null}
              </Card>
            );
          })
        )}
      </div>

      <PaySheet open={payOpen} onOpenChange={setPayOpen} driverId={payId} />
    </div>
  );
}
