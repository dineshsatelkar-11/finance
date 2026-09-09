import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useFinance } from "@/lib/finance/store";
import { inr, shortDate, uid } from "@/lib/finance/format";
import type { BankAccount } from "@/lib/finance/types";

export const Route = createFileRoute("/bank")({ component: BankPage });

function BankPage() {
  const month = useFinance((s) => s.month);
  const banks = useFinance((s) => s.banks);
  const payouts = useFinance((s) => s.payouts);
  const expenses = useFinance((s) => s.expenses);
  const drivers = useFinance((s) => s.drivers);
  const upsertBank = useFinance((s) => s.upsertBank);
  const setDefaultBank = useFinance((s) => s.setDefaultBank);
  const resetDemo = useFinance((s) => s.resetDemo);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [name, setName] = useState("");
  const [opening, setOpening] = useState("");
  const [asDefault, setAsDefault] = useState(false);
  const [error, setError] = useState("");

  const paidOut = [...payouts, ...expenses].filter(
    (r) => r.status === "paid" && r.date.startsWith(month),
  );

  function openAdd() {
    setEditing(null);
    setName("");
    setOpening("0");
    setAsDefault(banks.length === 0);
    setError("");
    setOpen(true);
  }

  function openEdit(b: BankAccount) {
    setEditing(b);
    setName(b.name);
    setOpening(String(b.opening));
    setAsDefault(b.isDefault);
    setError("");
    setOpen(true);
  }

  function save() {
    const n = name.trim();
    if (!n) {
      setError("Enter an account name.");
      return;
    }
    const openBal = Math.round((Number(opening) || 0) * 100) / 100;
    const row: BankAccount = {
      id: editing?.id || uid("bank"),
      name: n,
      opening: openBal,
      isDefault: asDefault || banks.length === 0,
    };
    upsertBank(row);
    if (row.isDefault) setDefaultBank(row.id);
    setOpen(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Bank</h1>
          <p className="mt-1 text-sm text-muted">
            Opening balances plus this month’s confirmed outflows. Pending UPI is not deducted.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button" onClick={openAdd}>
              Add bank
            </Button>
          </DialogTrigger>
          <DialogContent title={editing ? "Edit bank" : "Add bank"}>
            <div className="space-y-4 text-left">
              <div className="space-y-1.5">
                <Label htmlFor="bank-name">Account name</Label>
                <Input
                  id="bank-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. SBI Current · Pune"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bank-opening">Opening balance (₹)</Label>
                <Input
                  id="bank-opening"
                  type="number"
                  inputMode="decimal"
                  value={opening}
                  onChange={(e) => setOpening(e.target.value)}
                  placeholder="0"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={asDefault}
                  onChange={(e) => setAsDefault(e.target.checked)}
                  className="size-4 rounded border-line"
                />
                Set as default account
              </label>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={save}>
                  {editing ? "Save" : "Add account"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {banks.map((b) => {
          const out = paidOut
            .filter((r) => r.bankAccountId === b.id)
            .reduce((s, r) => s + r.amount, 0);
          return (
            <Card key={b.id}>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{b.name}</CardTitle>
                <div className="flex items-center gap-2">
                  {b.isDefault ? <Badge tone="accent">Default</Badge> : null}
                  <Button type="button" variant="outline" size="sm" onClick={() => openEdit(b)}>
                    Edit
                  </Button>
                </div>
              </div>
              <CardHint>Opening {inr(b.opening)}</CardHint>
              <div className="mt-4 font-display text-3xl font-medium tabular-nums tracking-tight">
                {inr(b.opening - out)}
              </div>
              <p className="mt-1 text-[12px] text-muted">Out this month {inr(out)}</p>
              {!b.isDefault ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={() => setDefaultBank(b.id)}
                >
                  Make default
                </Button>
              ) : null}
            </Card>
          );
        })}
      </div>

      {banks.length === 0 ? (
        <Card>
          <CardTitle>No bank accounts</CardTitle>
          <CardHint>Add HDFC, SBI, cash, or any account you use for payouts and expenses.</CardHint>
          <Button type="button" className="mt-4" onClick={openAdd}>
            Add bank
          </Button>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Ledger</CardTitle>
        <CardHint>Confirmed movements only.</CardHint>
        <ul className="mt-4 divide-y divide-line">
          {paidOut
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 20)
            .map((r) => {
              const label =
                "kind" in r
                  ? `${drivers.find((d) => d.id === r.driverId)?.name || "Driver"} · ${String(r.kind).replace("_", " ")}`
                  : `${r.category} · ${r.vendor}`;
              return (
                <li key={r.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <div className="font-medium capitalize">{label}</div>
                    <div className="text-[12px] text-muted">
                      {shortDate(r.date)} · {r.mode.toUpperCase()}
                    </div>
                  </div>
                  <div className="tabular-nums text-danger">−{inr(r.amount)}</div>
                </li>
              );
            })}
        </ul>
      </Card>

      <Button variant="outline" onClick={() => resetDemo()}>
        Reset demo data
      </Button>
    </div>
  );
}
