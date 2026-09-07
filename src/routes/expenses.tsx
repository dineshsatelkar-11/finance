import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { defaultBankId, useFinance } from "@/lib/finance/store";
import { inr, shortDate, todayISO } from "@/lib/finance/format";
import type { PayMode } from "@/lib/finance/types";
import { uid } from "@/lib/finance/format";
import { maskVpa } from "@/lib/finance/upi";

export const Route = createFileRoute("/expenses")({ component: ExpensesPage });

const CATS = ["Fuel", "Packaging", "Maintenance", "Toll", "Office", "Other"];

function ExpensesPage() {
  const month = useFinance((s) => s.month);
  const expenses = useFinance((s) => s.expenses);
  const vendors = useFinance((s) => s.vendors);
  const banks = useFinance((s) => s.banks);
  const record = useFinance((s) => s.recordExpense);
  const upsertVendor = useFinance((s) => s.upsertVendor);

  const [cat, setCat] = useState("Fuel");
  const [vendor, setVendor] = useState(vendors[0]?.name || "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState<PayMode>("upi");
  const [note, setNote] = useState("");

  const rows = useMemo(() => expenses.filter((e) => e.date.startsWith(month)), [expenses, month]);
  const total = rows.filter((e) => e.status === "paid").reduce((s, e) => s + e.amount, 0);
  const v = vendors.find((x) => x.name === vendor);

  function save() {
    const amt = parseFloat(amount);
    const r = record({
      category: cat,
      vendor,
      amount: amt,
      date,
      mode,
      bankAccountId: defaultBankId(),
      upiVpa: mode === "upi" ? v?.upiVpa : "",
      note,
    });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Expense saved");
    setAmount("");
    setNote("");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Expenses</h1>
        <p className="mt-1 text-sm text-muted">
          This month {inr(total)}. Vendor UPI is stored on the vendor, same pattern as drivers.
        </p>
      </div>

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
            <Label>Vendor</Label>
            <Select
              value={vendor}
              onValueChange={(name) => {
                setVendor(name);
                const found = vendors.find((x) => x.name === name);
                if (found?.upiVpa) setMode("upi");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendors.map((x) => (
                  <SelectItem key={x.id} value={x.name}>
                    {x.name}
                  </SelectItem>
                ))}
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ex-amt">Amount (₹)</Label>
            <Input id="ex-amt" inputMode="decimal" className="tabular-nums" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ex-date">Date</Label>
            <Input id="ex-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(x) => setMode(x as PayMode)}>
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
          <div>
            <Label htmlFor="ex-note">Note</Label>
            <Input id="ex-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        {mode === "upi" && v?.upiVpa ? (
          <p className="mt-3 text-[12px] text-muted">Pays vendor UPI on file. Saved with the vendor, not this device only.</p>
        ) : null}
        <Button className="mt-4" onClick={save}>
          Save expense
        </Button>
      </Card>

      <Card>
        <h2 className="font-display text-lg font-medium">Vendors</h2>
        <ul className="mt-3 divide-y divide-line">
          {vendors.map((x) => (
            <li key={x.id} className="flex items-center justify-between py-3 text-sm">
              <span className="font-medium">{x.name}</span>
              <span className="font-mono text-[12px] text-muted">{x.upiVpa ? maskVpa(x.upiVpa) : "No UPI"}</span>
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
            upsertVendor({
              id: uid("vnd"),
              name: name.trim(),
              upiVpa: upi.trim().toLowerCase(),
              upiPayeeName: name.trim(),
            });
            toast.success("Vendor added");
          }}
        >
          Add vendor
        </Button>
      </Card>

      <div className="space-y-2">
        {rows.map((e) => (
          <Card key={e.id} className="flex items-center justify-between p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{e.category}</span>
                <Badge tone="muted">{e.vendor}</Badge>
              </div>
              <p className="mt-1 text-[12px] text-muted">
                {shortDate(e.date)} · {e.mode.toUpperCase()}
                {e.note ? ` · ${e.note}` : ""}
              </p>
            </div>
            <div className="font-medium tabular-nums">{inr(e.amount)}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
