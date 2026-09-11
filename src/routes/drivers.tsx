import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { List, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DriverForm } from "@/components/finance/driver-form";
import { PaySheet } from "@/components/finance/pay-sheet";
import { useFinance } from "@/lib/finance/store";
import { driverBalance, inr, initials, suggestedSalary, WORKING_DAYS } from "@/lib/finance/format";
import { maskVpa } from "@/lib/finance/upi";
import type { Driver } from "@/lib/finance/types";

export const Route = createFileRoute("/drivers")({ component: DriversPage });

function DriversPage() {
  const drivers = useFinance((s) => s.drivers);
  const month = useFinance((s) => s.month);
  const attendances = useFinance((s) => s.attendances);
  const setAttendance = useFinance((s) => s.setAttendance);
  const removeDriver = useFinance((s) => s.removeDriver);
  const payouts = useFinance((s) => s.payouts);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payId, setPayId] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Drivers</h1>
          <p className="mt-1 text-sm text-muted">UPI is optional — add once when you pay, it stays on the driver.</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus /> Add
        </Button>
      </div>

      <div className="grid gap-3">
        {drivers.map((d) => (
          <Card key={d.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-11 items-center justify-center rounded-md bg-navy text-sm font-medium text-navy-fg">
                {initials(d.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-medium">{d.name}</h2>
                  <Badge tone="muted">{d.kind === "full" ? "Full-time" : "Part-time"}</Badge>
                  {d.upiVpa ? <Badge tone="ok">UPI</Badge> : null}
                  {!d.active ? <Badge tone="danger">Inactive</Badge> : null}
                </div>
                <p className="mt-1 text-[13px] text-muted">
                  {d.kind === "full" ? `Salary ${inr(d.baseSalary)}` : `Daily ${inr(d.dailyRate)}`}
                  {d.openingBalance ? ` · Open ${inr(d.openingBalance)}` : ""}
                  {d.mobile ? ` · ${d.mobile}` : ""}
                </p>
                <p className="mt-1 font-mono text-[12px] text-ink">
                  {d.upiVpa ? maskVpa(d.upiVpa) : "UPI optional — add when you pay"}
                </p>
                {(() => {
                  const att = attendances.find((a) => a.driverId === d.id && a.month === month);
                  const leaves = att?.leaveDays || 0;
                  const pay = suggestedSalary(d, leaves);
                  const bal = driverBalance(d, month, payouts, leaves);
                  return (
                    <p className="mt-1 text-[12px] text-muted">
                      Leave {leaves}d · suggested salary ≈ {inr(pay)} (settle at month end)
                      <button
                        type="button"
                        className="ml-2 text-accent underline-offset-2 hover:underline"
                        onClick={() => {
                          const raw = window.prompt(
                            `Leave days for ${d.name} (${month})`,
                            String(leaves),
                          );
                          if (raw == null) return;
                          const n = Math.max(0, Math.min(31, Math.floor(parseFloat(raw) || 0)));
                          setAttendance(d.id, month, n);
                        }}
                      >
                        Edit leave
                      </button>
                      <span className="mt-0.5 block">
                        Running balance {inr(bal)} (opening − paid; salary not included)
                      </span>
                    </p>
                  );
                })()}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button
                variant="outline"
                onClick={() => {
                  window.location.href = `/payouts?driver=${encodeURIComponent(d.id)}`;
                }}
              >
                <List className="size-3.5" /> Transactions
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(d);
                  setFormOpen(true);
                }}
              >
                Edit
              </Button>
              <Button
                onClick={() => {
                  setPayId(d.id);
                  setPayOpen(true);
                }}
              >
                <Wallet /> Pay
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (!window.confirm(`Delete driver "${d.name}" and their payout history?`)) return;
                  removeDriver(d.id);
                  toast.message("Driver deleted");
                }}
              >
                <Trash2 className="size-3.5" /> Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <DriverForm open={formOpen} onOpenChange={setFormOpen} driver={editing} />
      <PaySheet open={payOpen} onOpenChange={setPayOpen} driverId={payId} />
    </div>
  );
}
