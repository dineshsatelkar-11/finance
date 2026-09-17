import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { Payout } from "@/lib/finance/types";

export const Route = createFileRoute("/drivers")({ component: DriversPage });

function kindLabel(kind: Payout["kind"]) {
  switch (kind) {
    case "extra_route":
      return "Extra route";
    case "advance":
      return "Advance";
    case "return":
      return "Return";
    case "salary":
      return "Salary";
    case "bonus":
      return "Bonus";
    case "fine":
      return "Fine";
    default:
      return kind;
  }
}

function DriversPage() {
  const drivers = useFinance((s) => s.drivers);
  const month = useFinance((s) => s.month);
  const payouts = useFinance((s) => s.payouts);
  const attendances = useFinance((s) => s.attendances);
  const [payOpen, setPayOpen] = useState(false);
  const [payId, setPayId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  const active = drivers.filter((d) => d.active);

  const driverTx = useMemo(() => {
    if (!selectedDriverId) return [] as Payout[];
    return payouts
      .filter((p) => p.driverId === selectedDriverId)
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [payouts, selectedDriverId]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Drivers</h1>
        <p className="mt-1 text-sm text-muted">
          Balance + month salary. Tap a card to see transactions. Calculated month-end; usually paid next
          month 10–15 (net = salary − advances).
        </p>
      </div>

      <div className="grid gap-3">
        {active.length === 0 ? (
          <Card className="p-4">
            <p className="text-sm text-muted">
              No active drivers.{" "}
              <Link to="/manage-drivers" className="text-accent underline-offset-2 hover:underline">
                Add in Manage drivers
              </Link>
            </p>
          </Card>
        ) : (
          active.map((d) => {
            const bal = driverBalance(d, month, payouts);
            const leave =
              attendances.find((a) => a.driverId === d.id && a.month === month)?.leaveDays ?? 0;
            const gross = suggestedSalary(d, leave);
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
                      {inr(bal)}
                    </p>
                    <p className="text-[11px] text-subtle">
                      Running balance · advances only · tap to {selected ? "close" : "show"} transactions
                    </p>
                    {gross > 0 ? (
                      <p className="mt-1 text-[11px] text-muted tabular-nums">
                        This month salary {inr(gross)}
                        {adv > 0 ? ` − adv ${inr(adv)}` : ""}
                        {" → "}
                        <span className={net < 0 ? "text-warn" : "text-ink"}>net {inr(net)}</span>
                        <span className="text-subtle"> · pay next month ~10–15</span>
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => {
                      setPayId(d.id);
                      setPayOpen(true);
                    }}
                  >
                    <Wallet className="size-3.5" /> Pay
                  </Button>
                </div>

                {selected ? (
                  <div className="mt-4 border-t border-line pt-3" onClick={(e) => e.stopPropagation()}>
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
                          const isNeutral = p.kind === "extra_route" || p.kind === "salary" || p.kind === "bonus";
                          return (
                            <li key={p.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                              <div className="min-w-0 flex-1">
                                <div className="font-medium">{kindLabel(p.kind)}</div>
                                <div className="text-[12px] text-muted">
                                  {shortDate(p.date)} · {p.status}
                                  {p.note ? ` · ${p.note}` : ""}
                                </div>
                              </div>
                              <div
                                className={cn(
                                  "shrink-0 tabular-nums",
                                  isIn ? "text-ok" : isNeutral ? "text-muted" : "text-danger",
                                )}
                              >
                                {isIn ? "+" : isNeutral ? "" : "−"}
                                {inr(p.amount)}
                              </div>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </div>
                ) : null}
              </Card>
            );
          })
        )}
      </div>

      {active.length > 0 && !selectedDriverId ? (
        <p className="text-center text-sm text-muted">Tap a driver card to see transactions below the balance.</p>
      ) : null}

      <PaySheet open={payOpen} onOpenChange={setPayOpen} driverId={payId} />
    </div>
  );
}
