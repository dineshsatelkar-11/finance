import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PaySheet } from "@/components/finance/pay-sheet";
import { useFinance } from "@/lib/finance/store";
import {
  driverBalance,
  inr,
  initials,
  monthAdvances,
  netSalaryPayable,
  shortDate,
  suggestedSalary,
} from "@/lib/finance/format";
import { rememberDeletedId } from "@/lib/finance/sync";
import { cn } from "@/lib/utils";
import type { Payout } from "@/lib/finance/types";

export const Route = createFileRoute("/drivers")({ component: DriversPage });

function kindLabel(kind: string) {
  switch (kind) {
    case "salary":
      return "Salary";
    case "advance":
      return "Advance";
    case "extra_route":
      return "Extra route";
    case "bonus":
      return "Bonus";
    case "fine":
      return "Fine";
    case "return":
      return "Return";
    default:
      return kind;
  }
}

function DriversPage() {
  const month = useFinance((s) => s.month);
  const drivers = useFinance((s) => s.drivers);
  const payouts = useFinance((s) => s.payouts);
  const attendances = useFinance((s) => s.attendances);
  const removePayout = useFinance((s) => s.removePayout);

  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payDriverId, setPayDriverId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const active = drivers.filter((d) => d.active);

  const driverTx = useMemo(() => {
    if (!selectedDriverId) return [] as Payout[];
    return payouts
      .filter((p) => p.driverId === selectedDriverId)
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [payouts, selectedDriverId]);

  async function deleteTx(p: Payout) {
    if (!window.confirm("Delete this transaction?")) return;
    setDeletingId(p.id);
    rememberDeletedId(p.id);
    removePayout(p.id);
    setDeletingId(null);
    toast.message("Deleted");
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Drivers</h1>
          <p className="max-w-xl text-sm text-muted">
            Balance = opening − advances + returns − fines + salary slips. Gross uses calendar days in the
            month (leave default 0). Month-end post salary to balance; ~10th pay cash as advance.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/manage-drivers">Manage</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {active.length === 0 ? (
          <Card className="p-4">
            <p className="text-sm text-muted">No active drivers.</p>
          </Card>
        ) : (
          active.map((d) => {
            const bal = driverBalance(d, month, payouts);
            const leave =
              attendances.find((a) => a.driverId === d.id && a.month === month)?.leaveDays ?? 0;
            const gross = suggestedSalary(d, leave, month);
            const adv = monthAdvances(d.id, month, payouts);
            const net = netSalaryPayable(d, leave, month, payouts);
            const balClass = bal < 0 ? "text-warn" : bal > 0 ? "text-ink" : "text-muted";
            const selected = selectedDriverId === d.id;
            return (
              <Card
                key={d.id}
                className={cn(
                  "cursor-pointer p-4",
                  selected ? "ring-2 ring-accent" : "hover:ring-1 hover:ring-line",
                )}
                onClick={() => setSelectedDriverId(selected ? null : d.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-navy text-sm font-medium text-navy-fg">
                    {initials(d.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium">{d.name}</h2>
                      {selected ? <Badge tone="ok">Open</Badge> : null}
                    </div>
                    <p className={cn("mt-0.5 text-lg font-medium tabular-nums tracking-tight", balClass)}>
                      {inr(Math.abs(bal))}
                    </p>
                    <p className="text-[11px] text-subtle">
                      {bal > 0
                        ? "Company owes · "
                        : bal < 0
                          ? "Advance / driver owes · "
                          : "Settled · "}
                      tap to {selected ? "close" : "show"} transactions
                    </p>
                    {gross > 0 ? (
                      <p className="mt-1 text-[11px] text-muted tabular-nums">
                        This month salary {inr(gross)}
                        {adv > 0 ? ` − adv ${inr(adv)}` : ""}
                        {" → "}
                        <span className={net < 0 ? "text-warn" : "text-ink"}>net {inr(net)}</span>
                        <span className="text-subtle"> · slip → balance; cash ~10th as advance</span>
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setPayDriverId(d.id);
                        setPayOpen(true);
                      }}
                    >
                      <Wallet className="size-3.5" /> Pay
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDriverId(selected ? null : d.id)}
                    >
                      Transactions
                    </Button>
                  </div>

                  {selected ? (
                    <div className="mt-4 border-t border-line pt-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-[12px] font-medium text-muted">Transactions</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => setSelectedDriverId(null)}
                        >
                          Close
                        </Button>
                      </div>
                      <ul className="divide-y divide-line">
                        {driverTx.length === 0 ? (
                          <li className="py-4 text-center text-sm text-muted">No transactions for this driver yet.</li>
                        ) : (
                          driverTx.map((p) => {
                            const isIn = p.kind === "return";
                            const isNeutral = p.kind === "extra_route" || p.kind === "bonus";
                            const isSalary = p.kind === "salary";
                            return (
                              <li key={p.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium">{kindLabel(p.kind)}</div>
                                  <div className="text-[12px] text-muted">
                                    {shortDate(p.date)} · {p.status}
                                    {p.note ? ` · ${p.note}` : ""}
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                  <div
                                    className={cn(
                                      "tabular-nums",
                                      isIn || isSalary ? "text-ok" : isNeutral ? "text-muted" : "text-danger",
                                    )}
                                  >
                                    {isIn || isSalary ? "+" : isNeutral ? "" : "−"}
                                    {inr(p.amount)}
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-[11px] text-danger"
                                    disabled={deletingId === p.id}
                                    onClick={() => void deleteTx(p)}
                                  >
                                    <Trash2 className="size-3.5" />
                                    {deletingId === p.id ? "…" : "Del"}
                                  </Button>
                                </div>
                              </li>
                            );
                          })
                        )}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {active.length > 0 && !selectedDriverId ? (
        <p className="text-center text-sm text-muted">Tap a driver card to see transactions below the balance.</p>
      ) : null}

      <PaySheet open={payOpen} onOpenChange={setPayOpen} driverId={payDriverId} />
    </div>
  );
}
