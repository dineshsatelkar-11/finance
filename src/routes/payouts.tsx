import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Pencil, Trash2, Wallet, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PaySheet } from "@/components/finance/pay-sheet";
import { useFinance } from "@/lib/finance/store";
import { rememberDeletedSeedId, rememberDeletedId } from "@/lib/finance/sync";
import { inr, monthISO, monthLabel, prevMonthISO, shortDate } from "@/lib/finance/format";
import type { Payout } from "@/lib/finance/types";
import { printSalarySlip, slipFromSalaryPayout } from "@/lib/finance/salary-slip";

export const Route = createFileRoute("/payouts")({ component: PayoutsPage });

function PayoutsPage() {
  const month = useFinance((s) => s.month);
  const payouts = useFinance((s) => s.payouts);
  const drivers = useFinance((s) => s.drivers);
  const updatePayout = useFinance((s) => s.updatePayout);
  const removePayout = useFinance((s) => s.removePayout);
  const clearHeldOrFailedPayouts = useFinance((s) => s.clearHeldOrFailedPayouts);
  const setPayoutStatus = useFinance((s) => s.setPayoutStatus);
  const fleets = useFinance((s) => s.fleets);
  const attendances = useFinance((s) => s.attendances);

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
  const [monthFilter, setMonthFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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

  const monthOptions = useMemo(() => {
    const opts: string[] = [];
    let ym = monthISO();
    for (let i = 0; i < 12; i++) {
      opts.push(ym);
      ym = prevMonthISO(ym);
    }
    return opts;
  }, []);

  const rows = useMemo(() => {
    return payouts
      .filter((p) => !driverFilter || p.driverId === driverFilter)
      .filter((p) => !statusFilter || p.status === statusFilter)
      .filter((p) => !kindFilter || p.kind === kindFilter)
      .filter((p) => !monthFilter || p.date.startsWith(monthFilter))
      .filter((p) => !dateFrom || p.date >= dateFrom)
      .filter((p) => !dateTo || p.date <= dateTo)
      .slice()
      .sort((a, b) => {
        const d = b.date.localeCompare(a.date);
        if (d !== 0) return d;
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      });
  }, [payouts, driverFilter, statusFilter, kindFilter, monthFilter, dateFrom, dateTo]);

  const totalPaid = useMemo(
    () => rows.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0),
    [rows],
  );

  const heldFailed = payouts.filter(
    (p) => p.status === "pending" || p.status === "failed",
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
    updatePayout(editRow.id, {
      amount: Math.round(amt * 100) / 100,
      date: editDate,
      note: editNote,
    });
    toast.success("Updated");
    setEditRow(null);
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Pay</h1>
          <p className="text-sm text-muted">
            Total (filtered, paid) {inr(totalPaid)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {heldFailed.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (!window.confirm(`Clear ${heldFailed.length} held/failed?`)) return;
                const n = clearHeldOrFailedPayouts(month);
                toast.message(`Cleared ${n}`);
              }}
            >
              Clear held/failed
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setPayId(driverFilter || null);
              setPayOpen(true);
            }}
          >
            <Wallet className="size-3.5" /> Pay
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_CHIPS.map((c) => (
          <button
            key={c.id || "all-status"}
            type="button"
            className={
              "rounded-full border px-3 py-1 text-xs " +
              (statusFilter === c.id
                ? "border-navy bg-navy text-navy-fg"
                : "border-line bg-canvas text-muted")
            }
            onClick={() => setStatusFilter(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {KIND_CHIPS.map((c) => (
          <button
            key={c.id || "all-kind"}
            type="button"
            className={
              "rounded-full border px-3 py-1 text-xs " +
              (kindFilter === c.id
                ? "border-navy bg-navy text-navy-fg"
                : "border-line bg-canvas text-muted")
            }
            onClick={() => setKindFilter(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <Label className="text-[11px]">Month</Label>
          <select
            className="mt-1 block rounded-md border border-line bg-canvas px-2 py-1.5 text-sm"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          >
            <option value="">All months</option>
            {monthOptions.map((ym) => (
              <option key={ym} value={ym}>
                {monthLabel(ym)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-[11px]">From</Label>
          <Input className="mt-1" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-[11px]">To</Label>
          <Input className="mt-1" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        {monthFilter || dateFrom || dateTo ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => { setMonthFilter(""); setDateFrom(""); setDateTo(""); }}>
            Clear dates
          </Button>
        ) : null}
      </div>

      <ul className="space-y-2">
        {rows.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted">No payouts match filters.</Card>
        ) : (
          rows.map((p) => {
            const d = drivers.find((x) => x.id === p.driverId);
            return (
              <Card key={p.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
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
                  {p.kind === "salary" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const drv = drivers.find((x) => x.id === p.driverId);
                        if (!drv) {
                          toast.error("Driver not found");
                          return;
                        }
                        const data = slipFromSalaryPayout(drv, p, payouts, fleets, 0, attendances);
                        printSalarySlip(data);
                      }}
                    >
                      <FileText className="size-3.5" /> Slip
                    </Button>
                  ) : null}
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
                      rememberDeletedSeedId(p.id);
                      rememberDeletedId(p.id);
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
      </ul>

      <PaySheet open={payOpen} onOpenChange={setPayOpen} driverId={payId} />

      <Dialog open={!!editRow} onOpenChange={(v) => !v && setEditRow(null)}>
        <DialogContent title="Edit payout">
          <div className="space-y-3">
            <div>
              <Label>Amount ₹</Label>
              <Input inputMode="decimal" value={editAmt} onChange={(e) => setEditAmt(e.target.value)} />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </div>
            <div>
              <Label>Note</Label>
              <Input value={editNote} onChange={(e) => setEditNote(e.target.value)} />
            </div>
            <Button type="button" className="w-full" onClick={saveEdit}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
