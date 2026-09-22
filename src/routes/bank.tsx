import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
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
  const removePayout = useFinance((s) => s.removePayout);
  const removeExpense = useFinance((s) => s.removeExpense);
  const removeReceipt = useFinance((s) => s.removeReceipt);
  const removeLoanPayment = useFinance((s) => s.removeLoanPayment);
  const removeBankTransfer = useFinance((s) => s.removeBankTransfer);
  const recordBankTransfer = useFinance((s) => s.recordBankTransfer);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [opening, setOpening] = useState("0");
  const [clearing, setClearing] = useState(false);
  const [xferOpen, setXferOpen] = useState(false);
  const [xferFrom, setXferFrom] = useState("");
  const [xferTo, setXferTo] = useState("");
  const [xferAmount, setXferAmount] = useState("");
  const [xferDate, setXferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [xferNote, setXferNote] = useState("");

  function inScope(_date: string) {
    return true;
  }

  function forBank(bankAccountId: string) {
    return !selectedBankId || bankAccountId === selectedBankId;
  }

  const outByBank = useMemo(() => {
    const map = new Map<string, number>();
    const add = (id: string, amt: number) => map.set(id, (map.get(id) || 0) + amt);
    for (const r of payouts) {
      if (r.status === "paid" && r.kind !== "return") {
        add(r.bankAccountId, r.amount);
      }
    }
    for (const r of expenses) {
      if (r.status === "paid") add(r.bankAccountId, r.amount);
    }
    for (const r of loanPayments) {
      if (r.status === "paid" && r.kind !== "disbursement") add(r.bankAccountId, r.amount);
    }
    for (const x of bankTransfers) {
      add(x.fromBankId, x.amount);
    }
    return map;
  }, [payouts, expenses, loanPayments, bankTransfers]);

  const inByBank = useMemo(() => {
    const map = new Map<string, number>();
    const add = (id: string, amt: number) => map.set(id, (map.get(id) || 0) + amt);
    for (const r of receipts) {
      if (r.status === "paid") add(r.bankAccountId, r.amount);
    }
    for (const r of payouts) {
      if (r.status === "paid" && r.kind === "return") add(r.bankAccountId, r.amount);
    }
    for (const r of loanPayments) {
      if (r.status === "paid" && r.kind === "disbursement") add(r.bankAccountId, r.amount);
    }
    for (const x of bankTransfers) {
      add(x.toBankId, x.amount);
    }
    return map;
  }, [receipts, payouts, loanPayments, bankTransfers]);

  const balanceOf = (b: BankAccount) => {
    const out = outByBank.get(b.id) || 0;
    const inn = inByBank.get(b.id) || 0;
    return Math.round((b.opening - out + inn) * 100) / 100;
  };

  type LedgerRow = {
    id: string;
    date: string;
    label: string;
    sub: string;
    amount: number;
    dir: "in" | "out";
    source: "payout" | "expense" | "receipt" | "loan" | "xfer";
    sourceId: string;
  };

  const ledgerRows = useMemo(() => {
    const rows: LedgerRow[] = [];
    for (const r of payouts) {
      if (r.status !== "paid" || !forBank(r.bankAccountId) || !inScope(r.date)) continue;
      const d = drivers.find((x) => x.id === r.driverId);
      const isReturn = r.kind === "return";
      rows.push({
        id: `po-${r.id}`,
        date: r.date,
        label: `${d?.name || "Driver"} · ${r.kind}`,
        sub: r.note || "Payout",
        amount: r.amount,
        dir: isReturn ? "in" : "out",
        source: "payout",
        sourceId: r.id,
      });
    }
    for (const r of expenses) {
      if (r.status !== "paid" || !forBank(r.bankAccountId) || !inScope(r.date)) continue;
      rows.push({
        id: `ex-${r.id}`,
        date: r.date,
        label: r.vendor || r.category,
        sub: r.note || r.category,
        amount: r.amount,
        dir: "out",
        source: "expense",
        sourceId: r.id,
      });
    }
    for (const r of receipts) {
      if (r.status !== "paid" || !forBank(r.bankAccountId) || !inScope(r.date)) continue;
      rows.push({
        id: `rc-${r.id}`,
        date: r.date,
        label: r.customerName || "Receipt",
        sub: r.note || "Receipt",
        amount: r.amount,
        dir: "in",
        source: "receipt",
        sourceId: r.id,
      });
    }
    for (const r of loanPayments) {
      if (r.status !== "paid" || !forBank(r.bankAccountId) || !inScope(r.date)) continue;
      const loan = loans.find((l) => l.id === r.loanId);
      const isDisb = r.kind === "disbursement";
      rows.push({
        id: `lp-${r.id}`,
        date: r.date,
        label: `${loan?.name || "Loan"} · ${r.kind}`,
        sub: r.note || "Loan",
        amount: r.amount,
        dir: isDisb ? "in" : "out",
        source: "loan",
        sourceId: r.id,
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
      if (!selectedBankId || selectedBankId === x.fromBankId) {
        rows.push({
          id: `xf-out-${x.id}`,
          date: x.date,
          label: `Transfer to ${toName}`,
          sub: x.note || "Internal transfer",
          amount: x.amount,
          dir: "out",
          source: "xfer",
          sourceId: x.id,
        });
      }
      if (!selectedBankId || selectedBankId === x.toBankId) {
        if (selectedBankId === x.toBankId || !selectedBankId) {
          if (selectedBankId === x.toBankId) {
            rows.push({
              id: `xf-in-${x.id}`,
              date: x.date,
              label: `Transfer from ${fromName}`,
              sub: x.note || "Internal transfer",
              amount: x.amount,
              dir: "in",
              source: "xfer",
              sourceId: x.id,
            });
          }
        }
      }
    }
    rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return rows;
  }, [
    payouts,
    expenses,
    receipts,
    loanPayments,
    bankTransfers,
    drivers,
    loans,
    banks,
    selectedBankId,
  ]);

  function deleteRow(r: LedgerRow) {
    if (r.source === "xfer") {
      if (!window.confirm(`Delete transfer ${inr(r.amount)}? Both sides will be removed.`)) return;
    } else if (!window.confirm(`Delete this entry?`)) return;
    if (r.source === "payout") {
      removePayout(r.sourceId);
      toast.message("Driver transaction deleted");
    } else if (r.source === "expense") {
      removeExpense(r.sourceId);
      toast.message("Expense deleted");
    } else if (r.source === "receipt") {
      removeReceipt(r.sourceId);
      toast.message("Receipt deleted");
    } else if (r.source === "loan") {
      removeLoanPayment(r.sourceId);
      toast.message("Loan payment deleted");
    } else if (r.source === "xfer") {
      const res = removeBankTransfer(r.sourceId);
      if (!res.ok) toast.error(res.error);
      else toast.message("Bank transfer deleted");
    }
  }

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

  function openXfer() {
    const def = banks.find((b) => b.isDefault)?.id || banks[0]?.id || "";
    const other = banks.find((b) => b.id !== def)?.id || "";
    setXferFrom(def);
    setXferTo(other);
    setXferAmount("");
    setXferDate(new Date().toISOString().slice(0, 10));
    setXferNote("");
    setXferOpen(true);
  }

  function saveXfer() {
    const amount = Number(String(xferAmount).replace(/,/g, "").trim());
    const res = recordBankTransfer({
      fromBankId: xferFrom,
      toBankId: xferTo,
      amount,
      date: xferDate,
      note: xferNote,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Internal transfer saved");
    setXferOpen(false);
    setXferAmount("");
    setXferNote("");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Bank</h1>
          <p className="mt-1 text-sm text-muted">
            Tap a card to expand its transactions under the balance. Opening can be negative (OD).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={openXfer} disabled={banks.length < 2}>
            Internal transfer
          </Button>
          <Button type="button" onClick={openAdd}>
            Add bank
          </Button>
        </div>
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
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Warana Current" />
            </div>
            <div>
              <Label>Opening balance ₹</Label>
              <Input value={opening} onChange={(e) => setOpening(e.target.value)} inputMode="decimal" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" onClick={saveBank}>
                Save
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={xferOpen}
        onOpenChange={(o) => {
          setXferOpen(o);
          if (!o) {
            setXferAmount("");
            setXferNote("");
          }
        }}
      >
        <DialogContent title="Internal bank transfer">
          <div className="space-y-3 text-left">
            <p className="text-[13px] text-muted">
              Move money between your own accounts (e.g. CC → Current, Bajaj → Warana).
            </p>
            <div>
              <Label>From account</Label>
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-line bg-raised px-3 text-sm"
                value={xferFrom}
                onChange={(e) => setXferFrom(e.target.value)}
              >
                <option value="">Select</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>To account</Label>
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-line bg-raised px-3 text-sm"
                value={xferTo}
                onChange={(e) => setXferTo(e.target.value)}
              >
                <option value="">Select</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Amount ₹</Label>
              <Input
                value={xferAmount}
                onChange={(e) => setXferAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0"
              />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={xferDate} onChange={(e) => setXferDate(e.target.value)} />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input
                value={xferNote}
                onChange={(e) => setXferNote(e.target.value)}
                placeholder="OWN CC → Current"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" onClick={saveXfer}>
                Save transfer
              </Button>
              <Button type="button" variant="outline" onClick={() => setXferOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3 sm:grid-cols-2">
        {banks.map((b) => {
          const bal = balanceOf(b);
          const out = outByBank.get(b.id) || 0;
          const inn = inByBank.get(b.id) || 0;
          const selected = selectedBankId === b.id;
          return (
            <Card
              key={b.id}
              className={cn(
                "cursor-pointer p-4 transition-colors",
                selected ? "ring-2 ring-accent" : "hover:bg-accent-soft/40",
              )}
              onClick={() => setSelectedBankId(selected ? null : b.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="truncate">{b.name}</CardTitle>
                  {b.isDefault ? (
                    <Badge className="mt-1" variant="secondary">
                      Default
                    </Badge>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                  {!b.isDefault ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => setDefaultBank(b.id)}>
                      Set default
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
                {b.opening < 0 ? " (OD)" : ""} · tap to {selected ? "close" : "show"} transactions
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
                {inn > 0 ? ` · In ${inr(inn)}` : ""} all time
              </p>

              {selected ? (
                <div className="mt-4 border-t border-line pt-3" onClick={(e) => e.stopPropagation()}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[12px] font-medium text-muted">Transactions</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => setSelectedBankId(null)}
                    >
                      Close
                    </Button>
                  </div>
                  <ul className="divide-y divide-line">
                    {ledgerRows.length === 0 ? (
                      <li className="py-4 text-center text-sm text-muted">No transactions</li>
                    ) : (
                      ledgerRows.map((r) => (
                        <li key={r.id} className="flex items-start justify-between gap-2 py-2.5">
                          <div className="min-w-0">
                            <div className="font-medium">{r.label}</div>
                            <div className="text-[12px] text-muted">
                              {shortDate(r.date)} · {r.sub}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span
                              className={cn(
                                "font-medium tabular-nums",
                                r.dir === "in" ? "text-success" : "text-danger",
                              )}
                            >
                              {r.dir === "in" ? "+" : "−"}
                              {inr(r.amount)}
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-danger"
                              onClick={() => deleteRow(r)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      {banks.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted">No bank accounts yet. Add one to track balances.</Card>
      ) : null}

      <Card className="border-dashed p-4">
        <p className="text-[13px] text-muted">
          Danger zone — clears local + Neon finance data. Use only for a full reset.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-2 text-danger"
          disabled={clearing}
          onClick={async () => {
            if (!window.confirm("Clear ALL finance data? This cannot be undone.")) return;
            setClearing(true);
            try {
              const res = await clearAllFinanceData();
              if (!res.ok) toast.error(res.error || "Clear failed");
              else toast.success("All finance data cleared");
            } finally {
              setClearing(false);
            }
          }}
        >
          {clearing ? "Clearing…" : "Clear all finance data"}
        </Button>
      </Card>
    </div>
  );
}
