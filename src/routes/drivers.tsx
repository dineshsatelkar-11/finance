import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DriverForm } from "@/components/finance/driver-form";
import { useFinance } from "@/lib/finance/store";
import { inr, maskVpa, suggestedSalary } from "@/lib/finance/format";
import type { Driver } from "@/lib/finance/types";

export const Route = createFileRoute("/drivers")({ component: DriversPage });

function DriversPage() {
  const drivers = useFinance((s) => s.drivers);
  const attendances = useFinance((s) => s.attendances);
  const month = useFinance((s) => s.month);
  const setAttendance = useFinance((s) => s.setAttendance);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Drivers</h1>
          <p className="mt-1 text-sm text-muted">
            Keep UPI on the driver record. Opening balance tracks what the company already owes (or is owed).
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" /> Add
        </Button>
      </div>

      <div className="space-y-3">
        {drivers.map((d) => (
          <Card key={d.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-medium">{d.name}</h2>
                  <Badge tone="muted">{d.kind === "full" ? "Full-time" : "Part-time"}</Badge>
                  {d.upiVpa ? <Badge tone="ok">UPI on file</Badge> : <Badge tone="warn">No UPI</Badge>}
                  {!d.active ? <Badge tone="danger">Inactive</Badge> : null}
                </div>
                <p className="mt-1 text-[13px] text-muted">
                  {d.kind === "full" ? `Salary ${inr(d.baseSalary)}` : `Daily ${inr(d.dailyRate)}`}
                  {d.openingBalance ? ` · Open ${inr(d.openingBalance)}` : ""}
                  {d.mobile ? ` · ${d.mobile}` : ""}
                </p>
                <p className="mt-1 font-mono text-[12px] text-ink">
                  {d.upiVpa ? maskVpa(d.upiVpa) : "No UPI ID — payouts will ask you to add one"}
                </p>
                {(() => {
                  const att = attendances.find((a) => a.driverId === d.id && a.month === month);
                  const leaves = att?.leaveDays || 0;
                  const pay = suggestedSalary(d, leaves);
                  return (
                    <p className="mt-1 text-[12px] text-muted">
                      Leave {leaves}d · this month pay ≈ {inr(pay)}
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
                    </p>
                  );
                })()}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(d);
                  setFormOpen(true);
                }}
              >
                {d.upiVpa ? "Edit / change UPI" : "Add UPI ID"}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <DriverForm open={formOpen} onOpenChange={setFormOpen} driver={editing} />
    </div>
  );
}
