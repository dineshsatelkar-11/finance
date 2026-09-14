import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { List, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PaySheet } from "@/components/finance/pay-sheet";
import { useFinance } from "@/lib/finance/store";
import {
  driverBalance,
  inr,
  initials,
  monthAdvances,
  netSalaryPayable,
  suggestedSalary,
} from "@/lib/finance/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/drivers")({ component: DriversPage });

function DriversPage() {
  const drivers = useFinance((s) => s.drivers);
  const month = useFinance((s) => s.month);
  const payouts = useFinance((s) => s.payouts);
  const attendances = useFinance((s) => s.attendances);
  const [payOpen, setPayOpen] = useState(false);
  const [payId, setPayId] = useState<string | null>(null);

  const active = drivers.filter((d) => d.active);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Drivers</h1>
        <p className="mt-1 text-sm text-muted">
          Balance + month salary. Calculated month-end; usually paid next month 10–15 (net = salary − advances).
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
            const balClass =
              bal < 0 ? "text-warn" : bal > 0 ? "text-ink" : "text-muted";
            return (
              <Card key={d.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-navy text-sm font-medium text-navy-fg">
                    {initials(d.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-medium">{d.name}</h2>
                    <p className={cn("mt-0.5 text-lg font-medium tabular-nums tracking-tight", balClass)}>
                      {inr(bal)}
                    </p>
                    <p className="text-[11px] text-subtle">Running balance · advances only</p>
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
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button variant="outline" asChild>
                    <a href={`/payouts?driver=${encodeURIComponent(d.id)}`}>
                      <List className="size-3.5" /> Transactions
                    </a>
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setPayId(d.id);
                      setPayOpen(true);
                    }}
                  >
                    <Wallet className="size-3.5" /> Pay
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <PaySheet open={payOpen} onOpenChange={setPayOpen} driverId={payId} />
    </div>
  );
}
