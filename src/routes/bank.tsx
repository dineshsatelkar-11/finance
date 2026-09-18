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
import { clearAllFinanceData, flushFinanceSave } from "@/lib/finance/sync";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [fromBankId, setFromBankId] = useState("");
  const [toBankId, setToBankId] = useState("");
  const [xferAmount, setXferAmount] = useState("");
  const [xferDate, setXferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [xferNote, setXferNote] = useState("");
  const [xferSaving, setXferSaving] = useState(false);

  function inScope(_date: string) {
    return true; // all-time bank view
  }

  const outByBank = useMemo(() => {
    const m = new Map<string, number>();
    const add = (id: string | null | undefined, amt: number) => {
      if (!id) return;
      m.set(id, (m.get(id) || 0) + amt);
    };
    for (const p of payouts) {
      if (p.status === "failed") continue;
      add(p.bankAccountId, p.amount);
    }
    for (const e of expenses) {
      if (e.status === "failed") continue;
      add(e.bankAccountId, e.amount);
    }
    for (const lp of loanPayments) {
      if (lp.status === "failed") continue;
      if (lp.kind === "disbursement") continue;
      add(lp.bankAccountId, lp.amount);
    }
    for (const x of bankTransfers) {
      add(x.fromBankId, x.amount);
    }
    return m;
  }, [payouts, expenses, loanPayments, bankTransfers]);

  const inByBank = useMemo(() => {
    const m = new Map<string, number>();
    const add = (id: string | null | undefined, amt: number) => {
      if (!id) return;
      m.set(id, (m.get(id) || 0) + amt);
    };
    for (const r of receipts) {
      if (r.status === "failed") continue;
      add(r.bankAccountId, r.amount);
    }
    for (const p of payouts) {
      if (p.status === "failed") continue;
      if (p.kind === "return") add(p.bankAccountId, p.amount);
    }
    for (const lp of loanPayments) {
      if (lp.status === "failed") continue;
      if (lp.kind === "disbursement") add(lp.bankAccountId, lp.amount);
    }
    for (const x of bankTransfers) {
      add(x.toBankId, x.amount);
    }
    return m;
  }, [receipts, payouts, loanPayments, bankTransfers]);

  type LedgerSource = "payout" | "expense" | "loan" | "receipt" | "xfer";
  type LedgerRow = {
    id: string;
    source: LedgerSource;
    sourceId: string;
    date: string;
    kind: "out" | "in" | "xfer";
    label: string;
    sub: string;
    amount: number;
  };

  const ledger = useMemo(() => {
    const rows: LedgerRow[] = [];
    for (const p of payouts) {
      if (selectedBankId && p.bankAccountId !== selectedBankId) continue;
      if (p.status === "failed") continue;
      const drv = drivers.find((d) => d.id === p.driverId)?.name || "Driver";
      const isReturn = p.kind === "return";
      rows.push({
        id: `p-${p.id}`,
        source: "payout",
        sourceId: p.id,
        date: p.date,
        kind: isReturn ? "in" : "out",
        label: `${drv} · ${p.kind}`,
        sub: p.note || p.mode,
        amount: p.amount,
      });
    }
    for (const e of expenses) {
      if (selectedBankId && e.bankAccountId !== selectedBankId) continue;
      if (e.status === "failed") continue;
      rows.push({
        id: `e-${e.id}`,
        source: "expense",
        sourceId: e.id,
        date: e.date,
        kind: "out",
        label: e.vendor || e.category,
        sub: e.note || e.category,
        amount: e.amount,
      });
    }
    for (const r of receipts) {
      if (selectedBankId && r.bankAccountId !== selectedBankId) continue;
      if (r.status === "failed") continue;
      rows.push({
        id: `r-${r.id}`,
        source: "receipt",
        sourceId: r.id,
        date: r.date,
        kind: "in",
        label: r.customerName || "Receipt",
        sub: r.note || r.mode,
        amount: r.amount,
      });
    }
    for (const lp of loanPayments) {
      if (selectedBankId && lp.bankAccountId !== selectedBankId) continue;
      if (lp.status === "failed") continue;
      const loan = loans.find((l) => l.id === lp.loanId)?.name || "Loan";
      const isDisb = lp.kind === "disbursement";
      rows.push({
        id: `lp-${lp.id}`,
        source: "loan",
        sourceId: lp.id,
        date: lp.date,
        kind: isDisb ? "in" : "out",
        label: `${loan} · ${lp.kind}`,
        sub: lp.note || lp.mode,
        amount: lp.amount,
      });
    }
    for (const x of bankTransfers) {
      if (
        selectedBankId &&
        x.fromBankId !== selectedBankId &&
        x.toBankId !== selectedBankId
      ) {
        continue;
      }
      const fromName = banks.find((b) => b.id === x.fromBankId)?.name || "From";
      const toName = banks.find((b) => b.id === x.toBankId)?.name || "To";
      if (selectedBankId === x.fromBankId) {
        rows.push({
          id: `x-${x.id}`,
          source: "xfer",
          sourceId: x.id,
          date: x.date,
          kind: "out",
          label: `Transfer to ${toName}`,
          sub: x.note || "Internal transfer",
          amount: x.amount,
        });
      } else if (selectedBankId === x.toBankId) {
        rows.push({
          id: `x-${x.id}`,
          source: "xfer",
          sourceId: x.id,
          date: x.date,
          kind: "in",
          label: `Transfer from ${fromName}`,
          sub: x.note || "Internal transfer",
          amount: x.amount,
        });
      } else {
        rows.push({
          id: `x-${x.id}`,
          source: "xfer",
          sourceId: x.id,
          date: x.date,
          kind: "xfer",
          label: `Transfer · ${fromName} → ${toName}`,
          sub: x.note || "Internal",
          amount: x.amount,
        });
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

  function deleteLedgerRow(r: LedgerRow) {
    const msg =
      r.source === "xfer"
        ? `Delete transfer ${inr(r.amount)}? Both sides (debit and credit) will be removed.`
        : `Delete ${r.label} · ${inr(r.amount)}?`;
    if (!window.confirm(msg)) return;
    if (r.source === "payout") {
      removePayout(r.sourceId);
      toast.message("Payout deleted");
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
    void flushFinanceSave();
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
      toast.error("Name is required");
      return;
    }
    const openingBal = parseOpening(opening);
    if (editId) {
      const existing = banks.find((b) => b.id === editId);
      if (!existing) return;
      upsertBank({ ...existing, name: n, opening: openingBal });
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
    void flushFinanceSave();
  }

  function openTransfer() {
    const def = banks.find((b) => b.isDefault)?.id || banks[0]?.id || "";
    const other = banks.find((b) => b.id !== def)?.id || "";
    setFromBankId(def);
    setToBankId(other);
    setXferAmount("");
    setXferDate(new Date().toISOString().slice(0, 10));
    setXferNote("");
    setXferOpen(true);
  }

  async function saveTransfer() {
    const amount = Number(String(xferAmount).replace(/,/g, ""));
    setXferSaving(true);
    const res = recordBankTransfer({
      fromBankId,
      toBankId,
      amount,
      date: xferDate,
      note: xferNote,
    });
    if (!res.ok) {
      setXferSaving(false);
      toast.error(res.error);
      return;
    }
    const flush = await flushFinanceSave();
    setXferSaving(false);
    if (!flush.ok) {
      toast.error(flush.error || "Saved on screen but Neon write failed");
      return;
    }
    const fromN = banks.find((b) => b.id === fromBankId)?.name || "From";
    const toN = banks.find((b) => b.id === toBankId)?.name || "To";
    toast.success(`Transfer ${inr(amount)} · ${fromN} → ${toN}`);
    setXferOpen(false);
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
          <Button type="button" variant="outline" onClick={openTransfer} disabled={banks.length < 2}>
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
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Warana / Bajaj / HDFC"
                autoFocus
              />
            </div>
            <div>
              <Label>Opening balance (₹)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
                placeholder="0 or -5000 for OD"
              />
              <p className="mt-1 text-[11px] text-muted">
                Negative allowed — e.g. overdraft or starting overdrawn.
              </p>
            </div>
            <Button type="button" className="w-full" onClick={saveBank}>
              {editId ? "Save changes" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={xferOpen} onOpenChange={setXferOpen}>
        <DialogContent title="Internal bank transfer">
          <div className="space-y-3 text-left">
            <p className="text-[12px] text-muted">
              Move money between your accounts (e.g. Bajaj → Warana). Shows as − on source and + on destination.
            </p>
            <div>
              <Label>From account</Label>
              <Select value={fromBankId} onValueChange={setFromBankId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>To account</Label>
              <Select value={toBankId} onValueChange={setToBankId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (₹)</Label>
              <Input
                inputMode="decimal"
                className="tabular-nums"
                value={xferAmount}
                onChange={(e) => setXferAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0"
                autoFocus
              />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={xferDate} onChange={(e) => setXferDate(e.target.value)} />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input value={xferNote} onChange={(e) => setXferNote(e.target.value)} placeholder="Own account transfer" />
            </div>
            <Button type="button" className="w-full" disabled={xferSaving} onClick={() => void saveTransfer()}>
              {xferSaving ? "Saving…" : "Save transfer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3">
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
                  {selected ? <Badge tone="ok">Open</Badge> : null}
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
                      if (!window.confirm(`Delete bank ${b.name}?`)) return;
                      const res = removeBank(b.id);
                      if (!res.ok) toast.error(res.error);
                      else {
                        toast.message("Bank removed");
                        if (selectedBankId === b.id) setSelectedBankId(null);
                        void flushFinanceSave();
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted">Balance</div>
                  <div className="text-lg font-semibold tabular-nums">{inr(bal)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted">Opening</div>
                  <div className="tabular-nums">{inr(b.opening)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted">Out</div>
                  <div className="tabular-nums text-danger">{inr(out)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted">In</div>
                  <div className="tabular-nums text-ok">{inr(inn)}</div>
                </div>
              </div>

              {selected ? (
                <div className="mt-4 border-t border-line pt-3" onClick={(e) => e.stopPropagation()}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[12px] font-medium text-muted">Transactions</div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedBankId(null)}
                    >
                      Show all
                    </Button>
                  </div>
                  <ul className="max-h-80 space-y-2 overflow-y-auto">
                    {ledger.length === 0 ? (
                      <li className="text-sm text-muted">No transactions on this account.</li>
                    ) : (
                      ledger.map((r) => (
                        <li
                          key={r.id}
                          className="flex items-start justify-between gap-2 rounded-md border border-line bg-raised/50 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{r.label}</div>
                            <div className="text-[12px] text-muted">
                              {shortDate(r.date)} · {r.sub}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <div
                              className={
                                r.kind === "in"
                                  ? "tabular-nums text-ok"
                                  : r.kind === "xfer"
                                    ? "tabular-nums text-muted"
                                    : "tabular-nums text-danger"
                              }
                            >
                              {r.kind === "xfer" ? "↔" : r.kind === "in" ? "+" : "−"}
                              {inr(r.amount)}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 px-2"
                              title="Delete"
                              onClick={() => deleteLedgerRow(r)}
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
        <Card>
          <CardTitle>No banks</CardTitle>
          <CardHint>Add Warana, Bajaj, HDFC, or cash. Opening can be negative for OD.</CardHint>
          <Button className="mt-4" onClick={openAdd}>
            Add bank
          </Button>
        </Card>
      ) : !selectedBankId ? (
        <p className="text-center text-sm text-muted">Tap a bank card to see its transactions below the balance.</p>
      ) : null}

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
        {clearing ? "Clearing…" : "Clear all data"}
      </Button>
    </div>
  );
}
