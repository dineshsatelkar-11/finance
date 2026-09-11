import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
import type { Payout } from "@/lib/finance/types";

export const Route = createFileRoute("/payouts")({ component: PayoutsPage });

function PayoutsPage() {
  const month = useFinance((s) => s.month);
  const payouts = useFinance((s) => s.payouts);
  const drivers = useFinance((s) => s.drivers);
  const updatePayout = useFinance((s) => s.updatePayout);
  const removePayout = useFinance((s) => s.removePayout);
  const clearHeldOrFailedPayouts = useFinance((s) => s.clearHeldOrFailedPayouts);
  const setPayoutStatus = useFinance((s) => s.setPayoutStatus);

  const search =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const driverFilter = search?.get("driver") || "";
  const statusFromUrl = search?.get("status") || "";

  const [payOpen, setPayOpen] = useState(false);
  const [payId, setPayId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Payout | null>(null);
  const [editAmt, setEditAmt] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNote, setEditNote] = useState("");
  const [statusFilter, setStatusFilter] = useState(statusFromUrl);
  const [kindFilter, setKindFilter] = useState("");

  const STATUS_CHIPS = [
    { id: "", label: "All" },
    { id: "paid", label: "Paid" },
    { id: "pending", label: "Pending" },
    { id: "failed", label: "Failed" },
  ] as const;
  const KIND_CHIPS = [
    { id: "", label: "All types" },
    { id: "salary", label: "Salary" },
    { id: "advance", label: "Advance" },
    { id: "extra_route", label: "Extra route" },
    { id: "bonus", label: "Bonus" },
    { id: "fine", label: "Fine" },
    { id: "return", label: "Return" },
  ] as const;

  const rows = useMemo(() => {
    return payouts
      .filter((p) => p.date.startsWith(month))
      .filter((p) => !driverFilter || p.driverId === driverFilter)
      .filter((p) => !statusFilter || p.status === statusFilter)
      .filter((p) => !kindFilter || p.kind === kindFilter)
      .slice()
      .sort((a, b) => {
        const d = b.date.localeCompare(a.date);
        if (d !== 0) return d;
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      });
  }, [payouts, month, driverFilter, statusFilter, kindFilter]);

  const heldFailed = payouts.filter(
    (p) => p.date.startsWith(month) && (p.status === "pending" || p.status === "failed"),
  );

  function openEdit(p: Payout) {
    setEditRow(p);
    setEditAmt(String(p.amount));
    setEditDate(p.date || "");
    setEditNote(p.note || "");
  }

  function saveEdit() {
    if (!editRow) return;
    const amt = parseFloat(editAmt);
    if (!(amt > 0)) {
      toast.error("Amount must be greater than zero");
      return;
    }
    if (!editDate) {
      toast.error("Date is required");
      return;
    }
    updatePayout(editRow.id, { amount: amt, date: editDate, note: editNote.trim() });
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
        </div>
        <div className="flex flex-wrap gap-2">
          {heldFailed.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (
                  !window.confirm(
                    `Clear ${heldFailed.length} held/failed payout(s)? Paid rows stay.`,
                  )
                )
                  return;
                const n = clearHeldOrFailedPayouts(month);
                toast.success(`Cleared ${n}`);
              }}
            >
              Clear held/failed
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={() => {
              setPayId(driverFilter || null);
              setPayOpen(true);
            }}
          >
            <Wallet className="size-4" /> Pay
          </Button>
        </div>
      </div>

      {driverFilter ? (
        <p className="text-sm text-muted">
          Filtered to{" "}
          <span className="font-medium text-ink">
            {drivers.find((d) => d.id === driverFilter)?.name || "driver"}
          </span>
          .{" "}
          <a href="/payouts" className="text-accent underline-offset-2 hover:underline">
            Show all drivers
          </a>
        </p>
      ) : null}

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_CHIPS.map((c) => (
            <button
              key={c.id || "all-status"}
              type="button"
              onClick={() => setStatusFilter(c.id)}
              className={
                statusFilter === c.id
                  ? "rounded-full border border-accent bg-accent-soft px-3 py-1 text-[12px] font-medium text-accent"
                  : "rounded-full border border-line bg-raised px-3 py-1 text-[12px] text-muted hover:text-ink"
              }
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {KIND_CHIPS.map((c) => (
            <button
              key={c.id || "all-kind"}
              type="button"
              onClick={() => setKindFilter(c.id)}
              className={
                kindFilter === c.id
                  ? "rounded-full border border-accent bg-accent-soft px-3 py-1 text-[12px] font-medium text-accent"
                  : "rounded-full border border-line bg-raised px-3 py-1 text-[12px] text-muted hover:text-ink"
              }
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {rows.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">No payouts this month.</p>
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
                      <Badge tone="muted">{p.kind.replace("_", " ")}</Badge>
                      <Badge
                        tone={
                          p.status === "paid" ? "ok" : p.status === "failed" ? "danger" : "warn"
                        }
                      >
                        {p.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[12px] text-muted">
                      {shortDate(p.date)} · {p.mode.toUpperCase()}
                      {p.note ? ` · ${p.note}` : ""}
                    </p>
                  </div>
                  <div className="font-medium tabular-nums">{inr(p.amount)}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.status === "pending" ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setPayoutStatus(p.id, "paid");
                        toast.success("Marked paid");
                      }}
                    >
                      Mark paid
                    </Button>
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
                      toast.message("Deleted");
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
              <Label htmlFor="edit-date">Date</Label>
              <Input
                id="edit-date"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
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
