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
  const month = useFinance((s) => s.month);
  const upsertFleet = useFinance((s) => s.upsertFleet);
  const assignDriverFleet = useFinance((s) => s.assignDriverFleet);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [regNo, setRegNo] = useState("");
  const [kind, setKind] = useState<FleetKind>("mini");
  const [chargesRent, setChargesRent] = useState(true);
  const [rent, setRent] = useState("0");
  const [loanId, setLoanId] = useState<string>("none");
  const [note, setNote] = useState("");
  const [active, setActive] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterMonth, setFilterMonth] = useState(month);

  const monthOptions = useMemo(() => {
    const opts: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      opts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return opts;
  }, []);

  const monthLabel = (m: string) => {
    const [y, mo] = m.split("-").map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  };

  const allFleetSpendMonth = useMemo(() => {
    return expenses
      .filter((e) => e.status === "paid" && e.fleetId && e.date.startsWith(filterMonth))
      .reduce((s, e) => s + e.amount, 0);
  }, [expenses, filterMonth]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setRegNo("");
    setKind("mini");
    setChargesRent(true);
    setRent("0");
    setLoanId("none");
    setNote("");
    setActive(true);
  }

  function startAdd() {
    resetForm();
    setOpen(true);
  }

  function startEdit(f: Fleet) {
    setEditingId(f.id);
    setName(f.name);
    setRegNo(f.regNo || "");
    setKind(f.kind);
    const rentOn = fleetsChargesRent(f);
    setChargesRent(rentOn);
    setRent(rentOn && f.monthlyRent ? String(f.monthlyRent) : "0");
    setLoanId(f.loanId || "none");
    setNote(f.note || "");
    setActive(f.active);
    setOpen(true);
  }

  function save() {
    if (!name.trim()) {
      toast.error("Name required");
      return;
    }
    const monthlyRent = chargesRent ? Number(rent) || 0 : 0;
    upsertFleet({
      id: editingId || uid("fleet"),
      name: name.trim(),
      regNo: regNo.trim() || null,
      kind,
      chargesRent,
      monthlyRent,
      loanId: loanId === "none" ? null : loanId,
      note: note.trim() || null,
      active,
    });
    toast.success(editingId ? "Fleet updated" : "Fleet added");
    setOpen(false);
    resetForm();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold">Fleets</h1>
          <p className="text-[13px] text-muted">Vehicles, rent, drivers & maintenance spend</p>
        </div>
        <Button onClick={startAdd}>
          <Plus /> Add fleet
        </Button>
      </div>

      {open ? (
        <Card className="p-4 space-y-3">
          <CardTitle>{editingId ? "Edit fleet" : "New fleet"}</CardTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mini 8026" />
            </div>
            <div>
              <Label>Reg no</Label>
              <Input value={regNo} onChange={(e) => setRegNo(e.target.value)} placeholder="MH12…" />
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
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={chargesRent}
                  onChange={(e) => setChargesRent(e.target.checked)}
                />
                Charges rent to driver
              </label>
            </div>
            {chargesRent ? (
              <div>
                <Label>Monthly rent (₹)</Label>
                <Input value={rent} onChange={(e) => setRent(e.target.value)} inputMode="decimal" />
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <Label>Note</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Active
            </label>
          </div>
          <div className="flex gap-2">
            <Button onClick={save}>{editingId ? "Save changes" : "Save fleet"}</Button>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted">Fleet maintenance (tagged)</div>
            <div className="font-display text-2xl font-medium tabular-nums">{inr(allFleetSpendMonth)}</div>
            <p className="mt-1 text-[12px] text-muted">
              All vehicles · {monthLabel(filterMonth)} · only expenses with a fleet selected
            </p>
          </div>
          <div className="w-40">
            <Label className="text-[11px]">Month</Label>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m} value={m}>
                    {monthLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="grid gap-3">
        {fleets.map((f) => {
          const loan = loans.find((l) => l.id === f.loanId);
          const onVehicle = drivers.filter((d) => d.fleetId === f.id && d.active);
          const fleetExps = expenses
            .filter((e) => e.fleetId === f.id && e.status === "paid" && e.date.startsWith(filterMonth))
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date));
          const monthSpend = fleetExps.reduce((s, e) => s + e.amount, 0);
          const rentOn = fleetsChargesRent(f);
          const isOpen = expandedId === f.id;
          return (
            <Card key={f.id} className="p-4">
              <button
                type="button"
                className="flex w-full flex-wrap items-start justify-between gap-3 text-left"
                onClick={() => setExpandedId(isOpen ? null : f.id)}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-1 text-muted">
                    {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium">{f.name}</h2>
                      <Badge tone="muted">{f.kind}</Badge>
                      {rentOn ? (
                        <Badge tone="accent">Rent</Badge>
                      ) : (
                        <Badge tone="muted">Route only</Badge>
                      )}
                      {f.active ? <Badge tone="ok">Active</Badge> : <Badge tone="danger">Off</Badge>}
                    </div>
                    <p className="mt-1 text-[13px] text-muted">
                      {f.regNo || "No reg no"}
                      {rentOn && f.monthlyRent > 0
                        ? ` · Rent ${inr(f.monthlyRent)}/mo`
                        : rentOn
                          ? " · Rent not set"
                          : " · No rent (route)"}
                    </p>
                    {loan ? (
                      <p className="mt-1 text-[12px] text-muted">
                        Loan: {loan.name} · Outstanding {inr(loan.outstanding)}
                      </p>
                    ) : null}
                    {f.note ? <p className="mt-1 text-[12px] text-subtle">{f.note}</p> : null}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wide text-muted">
                    Spend · {monthLabel(filterMonth)}
                  </div>
                  <div className="font-display text-xl font-medium tabular-nums">{inr(monthSpend)}</div>
                  <div className="text-[12px] text-muted">{fleetExps.length} expense(s)</div>
                </div>
              </button>

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
              </div>

              {isOpen ? (
                <div className="mt-4 border-t border-line pt-3">
                  <div className="mb-2 text-[12px] font-medium text-muted">
                    Expenses · {monthLabel(filterMonth)}
                  </div>
                  {fleetExps.length === 0 ? (
                    <p className="text-[13px] text-subtle">
                      No expenses tagged to this vehicle for this month. In Spend, edit an expense and
                      choose this fleet.
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
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
