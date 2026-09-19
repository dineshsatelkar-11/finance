import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Pencil, Plus } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
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

function fleetsChargesRent(f: Fleet) {
  if (f.chargesRent != null) return f.chargesRent;
  return (f.monthlyRent || 0) > 0;
}

function FleetsPage() {
  const fleets = useFinance((s) => s.fleets);
  const loans = useFinance((s) => s.loans);
  const drivers = useFinance((s) => s.drivers);
  const expenses = useFinance((s) => s.expenses);
  const upsertFleet = useFinance((s) => s.upsertFleet);
  const removeFleet = useFinance((s) => s.removeFleet);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [regNo, setRegNo] = useState("");
  const [kind, setKind] = useState<FleetKind>("tempo");
  const [rentOn, setRentOn] = useState(false);
  const [rent, setRent] = useState("0");
  const [loanId, setLoanId] = useState("none");
  const [note, setNote] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  // Month filter is dashboard-only — fleet list shows full history
  const allFleetSpend = useMemo(() => {
    return expenses
      .filter((e) => e.status === "paid" && e.fleetId)
      .reduce((s, e) => s + e.amount, 0);
  }, [expenses]);

  function resetForm() {
    setEditId(null);
    setName("");
    setRegNo("");
    setKind("tempo");
    setRentOn(false);
    setRent("0");
    setLoanId("none");
    setNote("");
    setShowForm(false);
  }

  function startEdit(f: Fleet) {
    setEditId(f.id);
    setName(f.name);
    setRegNo(f.regNo || "");
    setKind(f.kind);
    const on = fleetsChargesRent(f);
    setRentOn(on);
    setRent(on && f.monthlyRent ? String(f.monthlyRent) : "0");
    setLoanId(f.loanId || "none");
    setNote(f.note || "");
    setShowForm(true);
  }

  function save() {
    if (!name.trim()) {
      toast.error("Name required");
      return;
    }
    const monthlyRent = rentOn ? Number(rent) || 0 : 0;
    upsertFleet({
      id: editId || uid("flt"),
      name: name.trim(),
      regNo: regNo.trim(),
      kind,
      monthlyRent,
      chargesRent: rentOn && monthlyRent > 0,
      active: true,
      loanId: loanId === "none" ? null : loanId,
      note: note.trim() || undefined,
    });
    toast.success(editId ? "Fleet updated" : "Fleet added");
    resetForm();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-medium tracking-tight">Fleets</h1>
          <p className="text-[13px] text-muted">Vehicles, rent, and tagged maintenance spend</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          <Plus className="size-4" /> Add fleet
        </Button>
      </div>

      {showForm ? (
        <Card className="space-y-3 p-4">
          <CardTitle>{editId ? "Edit fleet" : "New fleet"}</CardTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bajaj Wego" />
            </div>
            <div>
              <Label>Reg no</Label>
              <Input value={regNo} onChange={(e) => setRegNo(e.target.value)} placeholder="MH-12-ZP-2301" />
            </div>
            <div>
              <Label>Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as FleetKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mini">Mini</SelectItem>
                  <SelectItem value="tempo">Tempo</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Linked loan</Label>
              <Select value={loanId} onValueChange={setLoanId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {loans.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={rentOn}
                  onChange={(e) => setRentOn(e.target.checked)}
                />
                Charges monthly rent (driver pays company)
              </label>
              {rentOn ? (
                <div className="mt-2">
                  <Label>Monthly rent ₹</Label>
                  <Input value={rent} onChange={(e) => setRent(e.target.value)} inputMode="decimal" />
                </div>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <Label>Note</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={save}>{editId ? "Save" : "Add"}</Button>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted">Fleet maintenance (tagged)</div>
            <div className="font-display text-2xl font-medium tabular-nums">{inr(allFleetSpend)}</div>
            <p className="mt-1 text-[12px] text-muted">
              All vehicles · all time · only expenses with a fleet selected
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {fleets.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted">No fleets yet. Add a vehicle to tag expenses.</Card>
        ) : (
          fleets.map((f) => {
            const isOpen = openId === f.id;
            const onVehicle = drivers.filter((d) => d.fleetId === f.id && d.active);
            const fleetExps = expenses
              .filter((e) => e.fleetId === f.id && e.status === "paid")
              .slice()
              .sort((a, b) => (a.date < b.date ? 1 : -1));
            const totalSpend = fleetExps.reduce((s, e) => s + e.amount, 0);
            const linkedLoan = loans.find((l) => l.id === f.loanId);
            const rentOn = fleetsChargesRent(f);

            return (
              <Card key={f.id} className="overflow-hidden p-0">
                <button
                  type="button"
                  className="flex w-full items-start gap-3 p-4 text-left"
                  onClick={() => setOpenId(isOpen ? null : f.id)}
                >
                  <span className="mt-1 text-muted">
                    {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-base font-medium">{f.name}</span>
                      <Badge variant="outline">{f.kind}</Badge>
                      {f.regNo ? <Badge variant="secondary">{f.regNo}</Badge> : null}
                    </div>
                    <div className="mt-1 text-[12px] text-muted">
                      {onVehicle.length} driver(s)
                      {linkedLoan ? ` · Loan ${linkedLoan.name}` : ""}
                      {rentOn && f.monthlyRent > 0
                        ? ` · Rent ${inr(f.monthlyRent)}/mo`
                        : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[11px] uppercase tracking-wide text-muted">Spend · all time</div>
                    <div className="font-display text-xl font-medium tabular-nums">{inr(totalSpend)}</div>
                    <div className="text-[12px] text-muted">{fleetExps.length} expense(s)</div>
                  </div>
                </button>

                <div className="border-t border-line px-4 pb-4">
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(f);
                      }}
                    >
                      <Pencil className="size-3.5" /> Edit
                    </Button>
                    <Link
                      to="/expenses"
                      className="inline-flex h-8 items-center rounded-md border border-line px-3 text-[13px] text-accent"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Tag expense →
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Remove fleet ${f.name}?`)) {
                          removeFleet(f.id);
                          toast.success("Fleet removed");
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>

                  {isOpen ? (
                    <div className="mt-4 border-t border-line pt-3">
                      <div className="mb-2 text-[12px] font-medium text-muted">Expenses · all time</div>
                      {fleetExps.length === 0 ? (
                        <p className="text-[13px] text-subtle">
                          No expenses tagged to this vehicle. In Spend, edit an expense and choose this fleet.
                        </p>
                      ) : (
                        <ul className="divide-y divide-line rounded-lg border border-line">
                          {fleetExps.map((e) => (
                            <li key={e.id} className="flex items-start justify-between gap-2 px-3 py-2.5">
                              <div className="min-w-0">
                                <div className="font-medium">{e.vendor || e.category}</div>
                                <div className="text-[12px] text-muted">
                                  {e.date} · {e.category}
                                  {e.note ? ` · ${e.note}` : ""}
                                </div>
                              </div>
                              <div className="shrink-0 font-medium tabular-nums text-danger">{inr(e.amount)}</div>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="mt-4">
                        <div className="mb-2 text-[12px] font-medium text-muted">Assigned drivers</div>
                        {onVehicle.length === 0 ? (
                          <p className="text-[13px] text-subtle">None assigned</p>
                        ) : (
                          <ul className="text-[13px]">
                            {onVehicle.map((d) => (
                              <li key={d.id}>{d.name}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
