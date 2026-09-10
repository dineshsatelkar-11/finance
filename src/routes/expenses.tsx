import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { defaultBankId, useFinance } from "@/lib/finance/store";
import { inr, shortDate, todayISO, uid } from "@/lib/finance/format";
import type { PayMode } from "@/lib/finance/types";
import { maskVpa } from "@/lib/finance/upi";

export const Route = createFileRoute("/expenses")({ component: ExpensesPage });

const CATS = ["Fuel", "Packaging", "Maintenance", "Toll", "Office", "EMI", "Other"];

function ExpensesPage() {
  const month = useFinance((s) => s.month);
  const expenses = useFinance((s) => s.expenses);
  const vendors = useFinance((s) => s.vendors);
  const fleets = useFinance((s) => s.fleets);
  const record = useFinance((s) => s.recordExpense);
  const updateExpense = useFinance((s) => s.updateExpense);
  const removeExpense = useFinance((s) => s.removeExpense);
  const upsertVendor = useFinance((s) => s.upsertVendor);
  const removeVendor = useFinance((s) => s.removeVendor);

  const [cat, setCat] = useState("Fuel");
  const [vendorId, setVendorId] = useState("none");
  const [vendorFree, setVendorFree] = useState("");
  const [fleetId, setFleetId] = useState<string>("none");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState<PayMode>("upi");
  const [note, setNote] = useState("");

  const rows = useMemo(
    () => expenses.filter((e) => e.date.startsWith(month)),
    [expenses, month],
  );
  const total = rows.filter((e) => e.status === "paid").reduce((s, e) => s + e.amount, 0);
  const v = vendorId !== "none" ? vendors.find((x) => x.id === vendorId) : undefined;

  const fleetTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of rows) {
      if (e.status !== "paid" || !e.fleetId) continue;
      map.set(e.fleetId, (map.get(e.fleetId) || 0) + e.amount);
    }
    return [...map.entries()].map(([id, amt]) => ({
      fleet: fleets.find((f) => f.id === id),
      amt,
    }));
  }, [rows, fleets]);

  function save() {
    const amt = parseFloat(amount);
    const vendorName =
      v?.name ||
      vendorFree.trim() ||
      "General";
    const r = record({
      category: cat,
      vendor: vendorName,
      amount: amt,
      date,
      mode,
      bankAccountId: defaultBankId(),
      upiVpa: mode === "upi" ? v?.upiVpa : "",
      fleetId: fleetId === "none" ? null : fleetId,
      note,
    });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(
      mode === "upi" && v?.upiVpa
        ? `Expense saved · UPI ${maskVpa(v.upiVpa)}`
        : "Expense saved",
    );
    setAmount("");
    setNote("");
    setVendorFree("");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Expenses</h1>
        <p className="mt-1 text-sm text-muted">
          This month {inr(total)}. Vendor is optional — pick one to auto-fill UPI, or leave blank.
        </p>
      </div>

      {fleetTotals.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {fleetTotals.map(({ fleet, amt }) => (
            <Card key={fleet?.id || "x"} className="p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted">
                {fleet?.name || "Fleet"} · {fleet?.regNo || ""}
              </div>
              <div className="font-display text-xl font-medium tabular-nums">{inr(amt)}</div>
            </Card>
          ))}
        </div>
      ) : null}

      <Card>
        <h2 className="font-display text-lg font-medium">Add expense</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Category</Label>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Vendor (optional)</Label>
            <Select
              value={vendorId}
              onValueChange={(id) => {
                setVendorId(id);
                if (id !== "none") setVendorFree("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="No vendor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No vendor / general</SelectItem>
                {vendors.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.name}
                    {x.upiVpa ? ` · ${maskVpa(x.upiVpa)}` : " · no UPI"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {v?.upiVpa ? (
              <p className="mt-1 font-mono text-[12px] text-muted">Pays to {v.upiVpa}</p>
            ) : vendorId === "none" ? (
              <div className="mt-2">
                <Input
                  placeholder="Or type vendor name (optional)"
                  value={vendorFree}
                  onChange={(e) => setVendorFree(e.target.value)}
                />
              </div>
            ) : (
              <p className="mt-1 text-[12px] text-warn">No UPI on this vendor — add below</p>
            )}
          </div>
          <div>
            <Label>Fleet (optional)</Label>
            <Select value={fleetId} onValueChange={setFleetId}>
              <SelectTrigger>
                <SelectValue placeholder="Which vehicle?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No fleet / general</SelectItem>
                {fleets
                  .filter((f) => f.active)
                  .map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                      {f.regNo ? ` · ${f.regNo}` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ex-amt">Amount (₹)</Label>
            <Input
              id="ex-amt"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ex-date">Date</Label>
            <Input id="ex-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as PayMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="ex-note">Note</Label>
            <Input id="ex-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <Button className="mt-4" onClick={save}>
          Save expense
        </Button>
      </Card>

      <Card>
        <h2 className="font-display text-lg font-medium">Vendors</h2>
        <p className="mt-1 text-sm text-muted">Select a vendor above to auto-fill UPI when you pay.</p>
        <ul className="mt-3 divide-y divide-line">
          {vendors.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div>
                <span className="font-medium">{x.name}</span>
                <div className="font-mono text-[12px] text-muted">
                  {x.upiVpa ? maskVpa(x.upiVpa) : "No UPI"}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const name = window.prompt("Vendor name", x.name);
                    if (name == null) return;
                    const upi = window.prompt("UPI ID (optional)", x.upiVpa || "") ?? x.upiVpa;
                    upsertVendor({
                      ...x,
                      name: name.trim() || x.name,
                      upiVpa: (upi || "").trim().toLowerCase(),
                      upiPayeeName: name.trim() || x.upiPayeeName,
                    });
                    toast.success("Vendor updated");
                  }}
                >
                  <Pencil className="size-3.5" /> Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!window.confirm(`Delete vendor "${x.name}"?`)) return;
                    removeVendor(x.id);
                    toast.message("Vendor deleted");
                  }}
                >
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => {
            const name = window.prompt("Vendor name?");
            if (!name?.trim()) return;
            const upi = window.prompt("UPI ID (name@bank) — optional") || "";
            const id = uid("vnd");
            upsertVendor({
              id,
              name: name.trim(),
              upiVpa: upi.trim().toLowerCase(),
              upiPayeeName: name.trim(),
            });
            setVendorId(id);
            toast.success("Vendor added");
          }}
        >
          Add vendor
        </Button>
      </Card>

      <div className="space-y-2">
        {rows.map((e) => {
          const fleet = fleets.find((f) => f.id === e.fleetId);
          return (
            <Card key={e.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{e.category}</span>
                    <Badge tone="muted">{e.vendor}</Badge>
                    {fleet ? <Badge tone="accent">{fleet.name}</Badge> : null}
                  </div>
                  <p className="mt-1 text-[12px] text-muted">
                    {shortDate(e.date)} · {e.mode.toUpperCase()}
                    {e.upiVpa ? ` · ${maskVpa(e.upiVpa)}` : ""}
                    {e.note ? ` · ${e.note}` : ""}
                  </p>
                </div>
                <div className="font-medium tabular-nums">{inr(e.amount)}</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const raw = window.prompt("New amount (₹)", String(e.amount));
                    if (raw == null) return;
                    const amt = parseFloat(raw);
                    if (!(amt > 0)) {
                      toast.error("Invalid amount");
                      return;
                    }
                    const note = window.prompt("Note", e.note || "") ?? e.note;
                    updateExpense(e.id, { amount: amt, note: note || "" });
                    toast.success("Expense updated");
                  }}
                >
                  <Pencil className="size-3.5" /> Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!window.confirm("Delete this expense?")) return;
                    removeExpense(e.id);
                    toast.message("Expense deleted");
                  }}
                >
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
