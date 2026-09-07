import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DriverForm } from "@/components/finance/driver-form";
import { PaySheet } from "@/components/finance/pay-sheet";
import { useFinance } from "@/lib/finance/store";
import { inr, initials } from "@/lib/finance/format";
import { maskVpa } from "@/lib/finance/upi";
import type { Driver } from "@/lib/finance/types";

export const Route = createFileRoute("/drivers")({ component: DriversPage });

function DriversPage() {
  const drivers = useFinance((s) => s.drivers);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payId, setPayId] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Drivers</h1>
          <p className="mt-1 text-sm text-muted">UPI IDs live on the driver — they survive reloads and other phones on this desk.</p>
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
                  {d.upiVpa ? <Badge tone="ok">UPI on file</Badge> : <Badge tone="warn">No UPI</Badge>}
                  {!d.active ? <Badge tone="danger">Inactive</Badge> : null}
                </div>
                <p className="mt-1 text-[13px] text-muted">
                  {d.kind === "full" ? `Salary ${inr(d.baseSalary)}` : `Daily ${inr(d.dailyRate)}`}
                  {d.mobile ? ` · ${d.mobile}` : ""}
                </p>
                <p className="mt-1 font-mono text-[12px] text-ink">
                  {d.upiVpa ? maskVpa(d.upiVpa) : "No UPI ID — payouts will ask you to add one"}
                </p>
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
              <Button
                onClick={() => {
                  setPayId(d.id);
                  setPayOpen(true);
                }}
              >
                <Wallet /> Pay
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
