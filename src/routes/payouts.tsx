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
import { flushFinanceSave, rememberDeletedId } from "@/lib/finance/sync";
import { inr, monthISO, monthLabel, prevMonthISO, shortDate } from "@/lib/finance/format";
import { printSalarySlip, slipFromSalaryPayout } from "@/lib/finance/salary-slip";
import type { Payout } from "@/lib/finance/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/payouts")({ component: PayoutsPage });

function PayoutsPage() {
  const month = useFinance((s) => s.month);
  const setMonth = useFinance((s) => s.setMonth);
  const drivers = useFinance((s) => s.drivers);
  const payouts = useFinance((s) => s.payouts);
  const fleets = useFinance((s) => s.fleets);
  const attendances = useFinance((s) => s.attendances);
  const removePayout = useFinance((s) => s.removePayout);
  const setPayoutStatus = useFinance((s) => s.setPayoutStatus);
  const [statusFilter, setStatusFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [driverFilter, setDriverFilter] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [payDriverId, setPayDriverId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    { id: "extra_route", label: "Extra work" },
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

  const filtered = useMemo(() => {
    return payouts
      .filter((p) => {
        if (month && !p.date.startsWith(month)) return false;
        if (statusFilter && p.status !== statusFilter) return false;
        if (kindFilter && p.kind !== kindFilter) return false;
        if (driverFilter && p.driverId !== driverFilter) return false;
        return true;
      })
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [payouts, month, statusFilter, kindFilter, driverFilter]);

  async function deleteTx(p: Payout) {
    if (!window.confirm("Delete this transaction?")) return;
    setDeletingId(p.id);
    rememberDeletedId(p.id);
    removePayout(p.id);
    setDeletingId(null);
    toast.message("Deleted");
    const flush = await flushFinanceSave();
    if (!flush.ok) toast.error(flush.error || "Cloud save failed");
  }

  function kindLabel(kind: string) {
    return KIND_CHIPS.find((k) => k.id === kind)?.label || kind;
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Payouts</h1>
          <p className="text-sm text-muted">Advances, salary slips, extra work, fines, returns.</p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setPayDriverId(null);
            setPayOpen(true);
          }}
        >
          <Wallet className="size-3.5" /> Pay
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          className="h-9 rounded-md border border-line bg-raised px-2 text-sm"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        >
          {monthOptions.map((ym) => (
            <option key={ym} value={ym}>
              {monthLabel(ym)}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-line bg-raised px-2 text-sm"
          value={driverFilter}
          onChange={(e) => setDriverFilter(e.target.value)}
        >
          <option value="">All drivers</option>
          {drivers.filter((d) => d.active).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_CHIPS.map((c) => (
          <button
            key={c.id || "all-s"}
            type="button"
            className={cn(
              "rounded-full px-3 py-1 text-[12px] font-medium",
              statusFilter === c.id ? "bg-accent text-accent-fg" : "bg-raised text-muted",
            )}
            onClick={() => setStatusFilter(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {KIND_CHIPS.map((c) => (
          <button
            key={c.id || "all-k"}
            type="button"
            className={cn(
              "rounded-full px-3 py-1 text-[12px] font-medium",
              kindFilter === c.id ? "bg-accent text-accent-fg" : "bg-raised text-muted",
            )}
            onClick={() => setKindFilter(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <ul className="divide-y divide-line rounded-lg border border-line bg-raised">
        {filtered.length === 0 ? (
          <li className="py-8 text-center text-sm text-muted">No payouts match filters.</li>
        ) : (
          filtered.map((p) => {
            const d = drivers.find((x) => x.id === p.driverId);
            return (
              <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="font-medium">{d?.name || "Driver"} · {kindLabel(p.kind)}</div>
                  <div className="text-[12px] text-muted">
                    {shortDate(p.date)} · {p.status}
                    {p.note ? ` · ${p.note}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="tabular-nums text-sm font-medium">{inr(p.amount)}</span>
                  {p.kind === "salary" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => {
                        if (!d) return;
                        const data = slipFromSalaryPayout(d, p, payouts, fleets, 0, attendances);
                        printSalarySlip(data);
                      }}
                    >
                      <FileText className="size-3.5" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    disabled={deletingId === p.id}
                    onClick={() => deleteTx(p)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            );
          })
        )}
      </ul>

      <PaySheet open={payOpen} onOpenChange={setPayOpen} driverId={payDriverId} />
    </div>
  );
}
