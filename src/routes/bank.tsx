import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useFinance } from "@/lib/finance/store";
import { clearAllFinanceData } from "@/lib/finance/sync";
import { inr, shortDate, uid } from "@/lib/finance/format";
import type { BankAccount } from "@/lib/finance/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bank")({ component: BankPage });

/** Parse opening balance; allows negative (OD / overdrawn). */
function parseOpening(raw: string): number {
  const n = Number(String(raw).replace(/,/g, "").trim());
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function BankPage() {
  const month = useFinance((s) => s.month);
  const banks = useFinance((s) => s.banks);
  const payouts = useFinance((s) => s.payouts);
  const expenses = useFinance((s) => s.expenses);
  const receipts = useFinance((s) => s.receipts);
  const loanPayments = useFinance((s) => s.loanPayments);
  const loans = useFinance((s) => s.loans);
  const drivers = useFinance((s) => s.drivers);
  const bankTransfers = useFinance((s) => s.bankTransfers ?? []);
  const upsertBank = useFinance((s) => s.upsertBank);
  const removeBank = useFinance((s) => s.removeBank);
  const setDefaultBank = useFinance((s) => s.setDefaultBank);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [opening, setOpening] = useState("0");
  const [clearing, setClearing] = useState(false);

  const selectedBank = banks.find((b) => b.id === selectedBankId) || null;

  /** Month filter only when viewing all banks; selected account shows full history. */
  function inScope(date: string) {
    if (selectedBankId) return true;
    return date.startsWith(month);
  }

  function forBank(bankAccountId: string) {
    return !selectedBankId || bankAccountId === selectedBankId;
  }

  /** Outflow this month per bank (payouts + expenses + loan EMIs). */
  const outByBank = useMemo(() => {
    const map = new Map<string, number>();
    const add = (id: string, amt: number) => map.set(id, (map.get(id) || 0) + amt);
    for (const r of payouts) {
      if (r.status === "paid" && r.date.startsWith(month)) add(r.bankAccountId, r.amount);
    }
    for (const r of expenses) {
      if (r.status === "paid" && r.date.startsWith(month)) add(r.bankAccountId, r.amount);
    }
    for (const r of loanPayments) {
      if (r.status === "paid" && r.date.startsWith(month)) add(r.bankAccountId, r.amount);
    }
    return map;
  }, [payouts, expenses, loanPayments, month]);

  const inByBank = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of receipts) {
      if (r.status === "paid" && r.date.startsWith(month)) {
        map.set(r.bankAccountId, (map.get(r.bankAccountId) || 0) + r.amount);
      }
    }
    return map;
  }, [receipts, month]);

  type LedgerRow = {
    id: string;
    date: string;
    kind: "out" | "in" | "xfer";
    label: string;
    sub: string;
    amount: number;
  };

  const ledgerRows = useMemo(() => {
    const rows: LedgerRow[] = [];

    for (const r of payouts) {
      if (r.status !== "paid" || !inScope(r.date) || !forBank(r.bankAccountId)) continue;
      rows.push({
        id: r.id,
        date: r.date,
        kind: "out",
        label: `${drivers.find((d) => d.id === r.driverId)?.name || "Driver"} · ${String(r.kind).replace("_", " ")}`,
        sub: `Payout · ${r.mode.toUpperCase()}`,
        amount: r.amount,
      });
    }
    for (const r of expenses) {
      if (r.status !== "paid" || !inScope(r.date) || !forBank(r.bankAccountId)) continue;
      rows.push({
        id: r.id,
        date: r.date,
        kind: "out",
        label: `${r.category}${r.vendor && r.vendor !== "General" ? ` · ${r.vendor}` : ""}`,
        sub: `Expense · ${r.mode.toUpperCase()}`,
        amount: r.amount,
      });
    }
    for (const r of loanPayments) {
      if (r.status !== "paid" || !inScope(r.date) || !forBank(r.bankAccountId)) continue;
      const loan = loans.find((l) => l.id === r.loanId);
      rows.push({
        id: r.id,
        date: r.date,
        kind: "out",
        label: `${loan?.name || "Loan"} · ${String(r.kind).replace("_", " ")}`,
        sub: `Loan · ${r.mode.toUpperCase()}`,
        amount: r.amount,
      });
    }
    for (const r of receipts) {
      if (r.status !== "paid" || !inScope(r.date) || !forBank(r.bankAccountId)) continue;
      rows.push({
        id: r.id,
        date: r.date,
        kind: "in",
        label: r.customerName || "Receipt",
        sub: `In · ${r.mode.toUpperCase()}`,
        amount: r.amount,
      });
    }
    for (const x of bankTransfers) {
      if (!inScope(x.date)) continue;
      if (
        selectedBankId &&
        x.fromBankId !== selectedBankId &&
        x.toBankId !== selectedBankId
      ) {
        continue;
      }
      const fromName = banks.find((b) => b.id === x.fromBankId)?.name || "From";
      const toName = banks.find((b) => b.id === x.toBankId)?.name || "To";
      rows.push({
        id: x.id,
        date: x.date,
        kind: "xfer",
        label: `Transfer · ${fromName} \u2192 ${toName}`,
        sub: x.note || "Internal",
        amount: x.amount,
      });
    }

    return rows
      .sort((a, b) => {
        const d = b.date.localeCompare(a.date);
        if (d !== 0) return d;
        return b.id.localeCompare(a.id);
      })
      .slice(0, selectedBankId ? 80 : 40);
  }, [
    payouts,
    expenses,
    loanPayments,
    receipts,
    bankTransfers,
    banks,
    drivers,
    loans,
    selectedBankId,
    month,
  ]);

  function openAdd() {
    setEditId(null);
    setName("");
    setOpening("0");
    setOpen(true);
  }

  function openEdit(b: BankAccount) {
    setEditId(b.id);
    setName(b.name);
    setOpening(String(b.opening ?? 0));
    setOpen(true);
  }

  function saveBank() {
    const n = name.trim();
    if (!n) {
      toast.error("Account name required");
      return;
    }
    const openingBal = parseOpening(opening);
    if (editId) {
      const existing = banks.find((b) => b.id === editId);
      upsertBank({
        id: editId,
        name: n,
        opening: openingBal,
        isDefault: existing?.isDefault ?? false,
      });
      toast.success("Bank updated");
    } else {
      upsertBank({
        id: uid("bank"),
        name: n,
        opening: openingBal,
        isDefault: banks.length === 0,
      });
      toast.success("Bank added");
    }
    setOpen(false);
    setEditId(null);
    setName("");
    setOpening("0");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Bank</h1>
          <p className="mt-1 text-sm text-muted">
            Click a card to filter transactions. Opening can be negative (OD / overdrawn).
          </p>
        </div>
        <Button type="button" onClick={openAdd}>
          Add bank
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setEditId(null);
            setName("");
            setOpening("0");
          }
        }}
      >
        <DialogContent title={editId ? "Edit bank" : "Add bank"}>
          <div className="space-y-3 text-left">
            <div>
              <Label>Account name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Warana / Bajaj / HDFC"
                autoFocus
              />
            </div>
            <div>
              <Label>Opening balance (\u20b9)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
                placeholder="0 or -5000 for OD"
              />
              <p className="mt-1 text-[11px] text-muted">
                Negative allowed \u2014 e.g. overdraft or starting overdrawn.
              </p>
            </div>
            <Button type="button" className="w-full" onClick={saveBank}>
              {editId ? "Save changes" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3 sm:grid-cols-2">
        {banks.map((b) => {
          const out = outByBank.get(b.id) || 0;
          const inn = inByBank.get(b.id) || 0;
          const bal = b.opening - out + inn;
          const selected = selectedBankId === b.id;
          return (
            <Card
              key={b.id}
              className={cn(
                "cursor-pointer",
                selected ? "ring-2 ring-accent" : "hover:ring-1 hover:ring-line",
              )}
              onClick={() => setSelectedBankId(selected ? null : b.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{b.name}</CardTitle>
                <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  {b.isDefault ? <Badge tone="accent">Default</Badge> : null}
                  {selected ? <Badge tone="ok">Showing</Badge> : null}
                  {!b.isDefault ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => setDefaultBank(b.id)}>
                      Default
                    </Button>
                  ) : null}
                  <Button type="button" size="sm" variant="outline" onClick={() => openEdit(b)}>
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!window.confirm(`Delete ${b.name}?`)) return;
                      const r = removeBank(b.id);
                      if (!r.ok) toast.error(r.error);
                      else {
                        if (selectedBankId === b.id) setSelectedBankId(null);
                        toast.message("Deleted");
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
              <CardHint>
                Opening {inr(b.opening)}
                {b.opening < 0 ? " (OD)" : ""} \u00b7 tap for transactions
              </CardHint>
              <div
                className={cn(
                  "mt-4 font-display text-3xl font-medium tabular-nums",
                  bal < 0 ? "text-danger" : "",
                )}
              >
                {inr(bal)}
              </div>
              <p className="mt-1 text-[12px] text-muted">
                Out {inr(out)}
                {inn > 0 ? ` \u00b7 In ${inr(inn)}` : ""} this month
              </p>
            </Card>
          );
        })}
      </div>

      {banks.length === 0 ? (
        <Card>
          <CardTitle>No banks</CardTitle>
          <CardHint>Add Warana, Bajaj, HDFC, or cash. Opening can be negative for OD.</CardHint>
          <Button className="mt-4" onClick={openAdd}>
            Add bank
          </Button>
        </Card>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>{selectedBank ? `${selectedBank.name} transactions` : "Ledger"}</CardTitle>
            <CardHint>
              {selectedBank
                ? "All transactions for this account (payouts, expenses, EMIs, receipts, transfers). Tap card again to show all banks."
                : "This month across all accounts. Tap a bank card to filter."}
            </CardHint>
          </div>
          {selectedBankId ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setSelectedBankId(null)}>
              Show all
            </Button>
          ) : null}
        </div>
        <ul className="mt-4 divide-y divide-line">
          {ledgerRows.length === 0 ? (
            <li className="py-6 text-center text-sm text-muted">
              {selectedBank
                ? "No transactions linked to this account yet. Payouts/expenses/EMIs must use this bank when recording."
                : "No transactions this month."}
            </li>
          ) : (
            ledgerRows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <div className="font-medium capitalize">{r.label}</div>
                  <div className="text-[12px] text-muted">
                    {shortDate(r.date)} \u00b7 {r.sub}
                  </div>
                </div>
                <div
                  className={
                    r.kind === "in"
                      ? "tabular-nums text-ok"
                      : r.kind === "xfer"
                        ? "tabular-nums text-muted"
                        : "tabular-nums text-danger"
                  }
                >
                  {r.kind === "xfer" ? "\u2194" : r.kind === "in" ? "+" : "\u2212"}
                  {inr(r.amount)}
                </div>
              </li>
            ))
          )}
        </ul>
      </Card>

      <Button
        variant="outline"
        disabled={clearing}
        onClick={async () => {
          if (!window.confirm("Clear ALL data?")) return;
          setClearing(true);
          const res = await clearAllFinanceData();
          setClearing(false);
          if (!res.ok) window.alert(res.error || "Failed");
          else window.alert("Cleared.");
        }}
      >
        {clearing ? "Clearing\u2026" : "Clear all data"}
      </Button>
    </div>
  );
}
