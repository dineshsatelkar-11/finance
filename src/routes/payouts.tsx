import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Pencil, Trash2, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PaySheet } from "@/components/finance/pay-sheet";
import { useFinance } from "@/lib/finance/store";
import { inr, shortDate } from "@/lib/finance/format";
import { maskVpa } from "@/lib/finance/upi";
import type { Payout, PayoutStatus } from "@/lib/finance/types";

export const Route = createFileRoute("/payouts")({ component: PayoutsPage });

function tone(s: PayoutStatus) {
  if (s === "paid") return "ok" as const;
  if (s === "failed") return "danger" as const;
  return "warn" as const;
}

function readQuery() {
  if (typeof window === "undefined") return { driver: "", status: "all" as const };
  const q = new URLSearchParams(window.location.search);
  const st = q.get("status");
  const status =
    st === "pending" || st === "paid" || st === "failed" || st === "all" ? st : "all";
  return { driver: q.get("driver") || "", status: status as "all" | PayoutStatus };
}

function PayoutsPage() {
  const month = useFinance((s) => s.month);
  const drivers = useFinance((s) => s.drivers);
  const payouts = useFinance((s) => s.payouts);
  const setStatus = useFinance((s) => s.setPayoutStatus);
  const updatePayout = useFinance((s) => s.updatePayout);
  const removePayout = useFinance((s) => s.removePayout);
  const clearHeldOrFailedPayouts = useFinance((s) => s.clearHeldOrFailedPayouts);
  const navigate = useNavigate();

  const [payOpen, setPayOpen] = useState(false);
  const [payId, setPayId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | PayoutStatus>("all");
  const [driverFilter, setDriverFilter] = useState("");
  const [editRow, setEditRow] = useState<Payout | null>(null);
  const [editAmt, setEditAmt] = useState("");
  const [editNote, setEditNote] = useState("");

  useEffect(() => {
    const q = readQuery();
    setFilter(q.status === "all" ? "all" : q.status);
    setDriverFilter(q.driver);
  }, []);

  const rows = useMemo(() => {
    return payouts
      .filter((p) => p.date.startsWith(month))
      .filter((p) => (filter === "all" ? true : p.status === filter))
      .filter((p) => (driverFilter ? p.driverId === driverFilter : true))
      .slice()
      .sort((a, b) => {
        const d = b.date.localeCompare(a.date);
        if (d !== 0) return d;
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      });
  }, [payouts, month, filter, driverFilter]);

  const missing = drivers.filter((d) => d.active && !d.upiVpa);
  const heldFailedCount = payouts.filter(
    (p) => p.date.startsWith(month) && (p.status === "pending" || p.status === "failed"),
  ).length;

  function openEdit(p: Payout) {
    setEditRow(p);
    setEditAmt(String(p.amount));
    setEditNote(p.note || "");
  }

  function saveEdit() {
    if (!editRow) return;
    const amt = parseFloat(editAmt);
    if (!(amt > 0)) {
      toast.error("Amount must be greater than zero");
      return;
    }
    updatePayout(editRow.id, { amount: amt, note: editNote.trim() });
    toast.success("Payout updated");
    setEditRow(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Payouts</h1>
          <p className="mt-1 max-w-lg text-sm text-muted">
            Confirm after the money leaves. Edit or delete any row. Clear only removes held & failed.
          </p>
          {driverFilter ? (
            <p className="mt-1 text-[13px] text-accent">
              Showing {drivers.find((d) => d.id === driverFilter)?.name || "driver"} only.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setDriverFilter("");
                  void navigate({ to: "/payouts" });
                }}
              >
                Clear filter
              </button>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {heldFailedCount > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (
                  !window.confirm(
                    `Clear ${heldFailedCount} held/failed payout(s) this month? Paid rows stay.`,
                  )
                ) {
                  return;
                }
                const n = clearHeldOrFailedPayouts(month);
                toast.success(`Cleared ${n} row(s)`);
              }}
            >
              Clear held/failed
            </Button>
          ) : null}
          <Button
            onClick={() => {
              setPayId(null);
              setPayOpen(true);
            }}
          >
            <Wallet /> New payout
          </Button>
        </div>
      </div>

      {missing.length > 0 ? (
        <Card className="border-warn/25 bg-warn-soft p-4">
          <div className="text-sm font-medium text-warn">Cannot pay until UPI is on file</div>
          <p className="mt-1 text-[13px] text-warn/90">
            {missing.map((d) => d.name).join(", ")} — add UPI on the driver, then pay.
          </p>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
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
                  <div className="text-right font-display text-xl font-medium tabular-nums">
                    {inr(p.amount)}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.status === "pending" ? (
                    <>
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
                    </>
                  ) : null}
                  <Button type="button" variant="outline" size="sm" onClick={() => openEdit(p)}>
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!window.confirm("Delete this payout?")) return;
                      removePayout(p.id);
                      toast.message("Payout deleted");
                    }}
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent title="Edit payout">
          <div className="space-y-4 text-left">
            <div className="space-y-1.5">
              <Label htmlFor="edit-amt">Amount (₹)</Label>
              <Input
                id="edit-amt"
                type="number"
                inputMode="decimal"
                className="tabular-nums"
                value={editAmt}
                onChange={(e) => setEditAmt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-note">Note</Label>
              <Input
                id="edit-note"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
              />
            </div>
            <Button type="button" className="w-full" onClick={saveEdit}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PaySheet open={payOpen} onOpenChange={setPayOpen} driverId={payId} />
    </div>
  );
}
