import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFinance } from "@/lib/finance/store";
import { inr, uid } from "@/lib/finance/format";
import type { Fleet, FleetKind } from "@/lib/finance/types";

export const Route = createFileRoute("/fleets")({ component: FleetsPage });

function FleetsPage() {
  const fleets = useFinance((s) => s.fleets);
  const loans = useFinance((s) => s.loans);
  const drivers = useFinance((s) => s.drivers);
  const expenses = useFinance((s) => s.expenses);
  const month = useFinance((s) => s.month);
  const upsertFleet = useFinance((s) => s.upsertFleet);
  const assignDriverFleet = useFinance((s) => s.assignDriverFleet);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [regNo, setRegNo] = useState("");
  const [kind, setKind] = useState<FleetKind>("mini");
  const [rent, setRent] = useState("0");
  const [loanId, setLoanId] = useState<string>("none");

  function save() {
    if (!name.trim()) {
      toast.error("Fleet name required");
      return;
    }
    const f: Fleet = {
      id: uid("flt"),
      name: name.trim(),
      regNo: regNo.trim(),
      kind,
      monthlyRent: parseFloat(rent) || 0,
      active: true,
      loanId: loanId === "none" ? null : loanId,
      note: "",
    };
    upsertFleet(f);
    toast.success("Fleet added");
    setOpen(false);
    setName("");
    setRegNo("");
    setRent("0");
    setLoanId("none");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Fleet</h1>
          <p className="mt-1 text-sm text-muted">
            Vehicles on the books. Assign a driver, link a loan, and tag expenses so you see cost per vehicle.
          </p>
        </div>
        <Button onClick={() => setOpen((o) => !o)}>
          <Plus /> Add fleet
        </Button>
      </div>

      {open ? (
        <Card className="space-y-3">
          <CardTitle>New fleet</CardTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mini commercial" />
            </div>
            <div>
              <Label>Registration</Label>
              <Input value={regNo} onChange={(e) => setRegNo(e.target.value)} placeholder="MH-12-AB-1234" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as FleetKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mini">Mini</SelectItem>
                  <SelectItem value="tempo">Tempo</SelectItem>
                  <SelectItem value="truck">Truck</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Monthly rent to driver (₹)</Label>
              <Input type="number" value={rent} onChange={(e) => setRent(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Linked loan</Label>
              <Select value={loanId} onValueChange={setLoanId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No loan</SelectItem>
                  {loans.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={save}>Save fleet</Button>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {fleets.map((f) => {
          const loan = loans.find((l) => l.id === f.loanId);
          const onVehicle = drivers.filter((d) => d.fleetId === f.id && d.active);
          const monthSpend = expenses
            .filter((e) => e.fleetId === f.id && e.date.startsWith(month) && e.status === "paid")
            .reduce((s, e) => s + e.amount, 0);
          return (
            <Card key={f.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-medium">{f.name}</h2>
                    <Badge tone="muted">{f.kind}</Badge>
                    {f.active ? <Badge tone="ok">Active</Badge> : <Badge tone="danger">Off</Badge>}
                  </div>
                  <p className="mt-1 text-[13px] text-muted">
                    {f.regNo || "No reg no"}
                    {f.monthlyRent > 0 ? ` · Rent ${inr(f.monthlyRent)}/mo` : " · Company vehicle"}
                  </p>
                  {loan ? (
                    <p className="mt-1 text-[12px] text-muted">
                      Loan: {loan.name} · Outstanding {inr(loan.outstanding)}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wide text-muted">Spend this month</div>
                  <div className="font-display text-xl font-medium tabular-nums">{inr(monthSpend)}</div>
                  <Link to="/expenses" className="text-[12px] text-accent underline-offset-2 hover:underline">
                    Tag in expenses →
                  </Link>
                </div>
              </div>
              <div className="mt-4 border-t border-line pt-3">
                <div className="mb-2 text-[12px] font-medium text-muted">Assigned drivers</div>
                {onVehicle.length === 0 ? (
                  <p className="text-[13px] text-subtle">None yet — pick a driver below.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {onVehicle.map((d) => (
                      <Badge key={d.id} tone="accent">
                        {d.name}
                      </Badge>
                    ))}
                  </ul>
                )}
                <div className="mt-3 max-w-xs">
                  <Label className="text-[12px]">Assign driver</Label>
                  <Select
                    onValueChange={(driverId) => {
                      if (driverId === "none") return;
                      assignDriverFleet(driverId, f.id);
                      toast.success("Driver assigned to fleet");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose driver…" />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers
                        .filter((d) => d.active)
                        .map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                            {d.fleetId === f.id ? " (current)" : d.fleetId ? " (other fleet)" : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
