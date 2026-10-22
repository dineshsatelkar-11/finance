import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, Check, Pencil, Trash2 } from "lucide-react";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { defaultBankId, useFinance } from "@/lib/finance/store";
import { inr, loanPrincipalApplied, shortDate, splitLoanPayment, todayISO } from "@/lib/finance/format";
import { flushFinanceSave } from "@/lib/finance/sync";
import type { Loan, LoanPayment, LoanPaymentKind, PayMode, PayoutStatus } from "@/lib/finance/types";

export const Route = createFileRoute("/loans")({ component: LoansPage });

function bankName(banks: { id: string; name: string }[], id: string) {
  return banks.find((b) => b.id === id)?.name || "—";
}

function LoansPage() {
  const loans = useFinance((s) => s.loans);
  const loanPayments = useFinance((s) => s.loanPayments);
  const fleets = useFinance((s) => s.fleets);
  const banks = useFinance((s) => s.banks);
  const month = useFinance((s) => s.month);
  const recordLoanPayment = useFinance((s) => s.recordLoanPayment);
  const ensureMonthlyEmi = useFinance((s) => s.ensureMonthlyEmi);
  const upsertLoan = useFinance((s) => s.upsertLoan);
  const updateLoanPayment = useFinance((s) => s.updateLoanPayment);
  const removeLoanPayment = useFinance((s) => s.removeLoanPayment);
  const removeLoan = useFinance((s) => s.removeLoan);

  const [selected, setSelected] = useState(loans[0]?.id || "");
  const loan = loans.find((l) => l.id === selected) || loans[0];

  // Edit loan account dialog
  const [loanEditOpen, setLoanEditOpen] = useState(false);
  const [loanForm, setLoanForm] = useState({
    name: "",
    bank: "",
    accountNo: "",
    ifsc: "",
    principal: "",
    outstanding: "",
    emiAmount: "",
    emiDay: "",
    interestRate: "",
    pendingEmis: "",
    totalEmis: "",
    status: "active" as Loan["status"],
    note: "",
  });

  // Record / edit payment dialog
  const [payOpen, setPayOpen] = useState(false);
  const [editingPayId, setEditingPayId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(todayISO());
  const [payMode, setPayMode] = useState<PayMode>("bank");
  const [payBankId, setPayBankId] = useState("");
  const [payKind, setPayKind] = useState<LoanPaymentKind>("emi");
  const [payStatus, setPayStatus] = useState<PayoutStatus>("paid");
  const [payNote, setPayNote] = useState("");
  const [payPrincipal, setPayPrincipal] = useState("");
  const [payInterest, setPayInterest] = useState("");
  const [splitLocked, setSplitLocked] = useState(false); // true if user manually edited principal/interest

  useEffect(() => {
    try {
      for (const l of loans) {
        if (l.status === "active") ensureMonthlyEmi(l.id);
      }
    } catch (e) {
      console.error("ensureMonthlyEmi failed", e);
    }
  }, [loans, month, ensureMonthlyEmi]);

  // Newest first (same as driver / payout transactions)
  const rows = useMemo(() => {
    return loanPayments
      .filter((p) => !loan || p.loanId === loan.id)
      .slice()
      .sort((a, b) => {
        const d = b.date.localeCompare(a.date);
        if (d !== 0) return d;
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      });
  }, [loanPayments, loan]);

  const pendingThisMonth = loanPayments.filter(
    (p) => p.kind === "emi" && p.status === "pending" && p.date.startsWith(month),
  );

  function openLoanEdit() {
    if (!loan) return;
    setLoanForm({
      name: loan.name,
      bank: loan.bank,
      accountNo: loan.accountNo,
      ifsc: loan.ifsc,
      principal: String(loan.principal),
      outstanding: String(loan.outstanding),
      emiAmount: String(loan.emiAmount),
      emiDay: String(loan.emiDay),
      interestRate: String(loan.interestRate),
      pendingEmis: String(loan.pendingEmis),
      totalEmis: String(loan.totalEmis),
      status: loan.status,
      note: loan.note || "",
    });
    setLoanEditOpen(true);
  }

  async function saveLoanEdit() {
    if (!loan) return;
    const principal = Number(loanForm.principal);
    const outstanding = Number(loanForm.outstanding);
    const emiAmount = Number(loanForm.emiAmount);
    const emiDay = Number(loanForm.emiDay);
    const interestRate = Number(loanForm.interestRate);
    const pendingEmis = Number(loanForm.pendingEmis);
    const totalEmis = Number(loanForm.totalEmis);
    if (!(principal >= 0) || !(outstanding >= 0) || !(emiAmount > 0)) {
      toast.error("Check principal / outstanding / EMI amount");
      return;
    }
    if (!(emiDay >= 1 && emiDay <= 31)) {
      toast.error("EMI day must be 1–31");
      return;
    }
    const next: Loan = {
      ...loan,
      name: loanForm.name.trim() || loan.name,
      bank: loanForm.bank.trim() || loan.bank,
      accountNo: loanForm.accountNo.trim() || loan.accountNo,
      ifsc: loanForm.ifsc.trim() || loan.ifsc,
      principal,
      outstanding,
      emiAmount,
      emiDay,
      interestRate: Number.isFinite(interestRate) ? interestRate : loan.interestRate,
      pendingEmis: Number.isFinite(pendingEmis) ? Math.max(0, Math.round(pendingEmis)) : loan.pendingEmis,
      totalEmis: Number.isFinite(totalEmis) ? Math.max(0, Math.round(totalEmis)) : loan.totalEmis,
      status: loanForm.status,
      note: loanForm.note.trim(),
    };
    upsertLoan(next);
    setLoanEditOpen(false);
    const flush = await flushFinanceSave();
    if (!flush.ok) toast.error(flush.error || "Saved locally — cloud write failed");
    else toast.success("Loan account updated");
  }

  function applyAutoSplit(amountStr: string, forLoan: Loan | undefined) {
    if (!forLoan || splitLocked) return;
    const amt = Number(amountStr);
    if (!(amt > 0)) {
      setPayPrincipal("");
      setPayInterest("");
      return;
    }
    // When editing, approximate balance before this payment so split is correct
    let bal = forLoan.outstanding;
    if (editingPayId) {
      const prev = loanPayments.find((x) => x.id === editingPayId);
      if (prev && prev.status === "paid") {
        bal = bal + loanPrincipalApplied(prev);
      }
    }
    const split = splitLoanPayment(bal, amt, forLoan.interestRate);
    setPayPrincipal(String(split.principal));
    setPayInterest(String(split.interest));
  }

  function openNewPay() {
    if (!loan) return;
    setEditingPayId(null);
    setPayAmount(String(loan.emiAmount));
    setPayDate(todayISO());
    setPayMode("bank");
    setPayBankId(defaultBankId() || banks[0]?.id || "");
    setPayKind("emi");
    setPayStatus("paid");
    setPayNote("EMI paid");
    setSplitLocked(false);
    const split = splitLoanPayment(loan.outstanding, loan.emiAmount, loan.interestRate);
    setPayPrincipal(String(split.principal));
    setPayInterest(String(split.interest));
    setPayOpen(true);
  }

  function openEditPay(p: LoanPayment) {
    if (!loan) return;
    setEditingPayId(p.id);
    setPayAmount(String(p.amount));
    setPayDate(p.date);
    setPayMode(p.mode);
    setPayBankId(p.bankAccountId || defaultBankId() || banks[0]?.id || "");
    setPayKind(p.kind);
    setPayStatus(p.status);
    setPayNote(p.note || "");
    setSplitLocked(false);
    if (p.principal != null || p.interest != null) {
      setPayPrincipal(p.principal != null ? String(p.principal) : "");
      setPayInterest(p.interest != null ? String(p.interest) : "");
    } else {
      applyAutoSplit(String(p.amount), loan);
    }
    setPayOpen(true);
  }

  async function savePay() {
    if (!loan) return;
    const amount = Number(payAmount);
    if (!(amount > 0)) {
      toast.error("Amount must be greater than zero");
      return;
    }
    if (!payBankId) {
      toast.error("Select bank account");
      return;
    }
    let principal = payPrincipal === "" ? undefined : Number(payPrincipal);
    let interest = payInterest === "" ? undefined : Number(payInterest);
    if (
      (payKind === "emi" || payKind === "prepay") &&
      (principal == null || interest == null || !Number.isFinite(principal) || !Number.isFinite(interest))
    ) {
      let bal = loan.outstanding;
      if (editingPayId) {
        const prev = loanPayments.find((x) => x.id === editingPayId);
        if (prev && prev.status === "paid") bal += loanPrincipalApplied(prev);
      }
      const split = splitLoanPayment(bal, amount, loan.interestRate);
      principal = split.principal;
      interest = split.interest;
    }

    if (editingPayId) {
      updateLoanPayment(editingPayId, {
        amount,
        date: payDate,
        mode: payMode,
        bankAccountId: payBankId,
        kind: payKind,
        status: payStatus,
        note: payNote.trim(),
        principal,
        interest,
      });
      setPayOpen(false);
      const flush = await flushFinanceSave();
      if (!flush.ok) toast.error(flush.error || "Saved locally — cloud write failed");
      else toast.success("Loan transaction updated");
      return;
    }

    const r = recordLoanPayment({
      loanId: loan.id,
      kind: payKind,
      amount,
      date: payDate,
      mode: payMode,
      bankAccountId: payBankId,
      note: payNote.trim() || (payKind === "emi" ? "EMI paid" : ""),
      reduceBalance: payStatus === "paid",
      principal,
      interest,
    });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    // If recorded as pending, flip status without double-cutting principal
    if (payStatus === "pending") {
      updateLoanPayment(r.id, { status: "pending" });
    }
    setPayOpen(false);
    const flush = await flushFinanceSave();
    if (!flush.ok) toast.error(flush.error || "Saved locally — cloud write failed");
    else {
      toast.success(
        payKind === "emi"
          ? `EMI ${inr(amount)} · P ${inr(principal || 0)} · I ${inr(interest || 0)}`
          : `Payment ${inr(amount)} recorded`,
      );
    }
  }

  function markPaid(id: string) {
    const p = loanPayments.find((x) => x.id === id);
    if (!p || !loan) return;
    // Open edit so user can pick bank + confirm P/I before marking paid
    openEditPay(p);
    setPayStatus("paid");
    if (!p.bankAccountId) {
      setPayBankId(defaultBankId() || banks[0]?.id || "");
    }
    if (p.principal == null || p.interest == null) {
      setSplitLocked(false);
      applyAutoSplit(String(p.amount), loan);
    }
  }

  async function deletePay(id: string) {
    if (!window.confirm("Delete this loan transaction? Outstanding will be adjusted.")) return;
    removeLoanPayment(id);
    const flush = await flushFinanceSave();
    if (!flush.ok) toast.error(flush.error || "Deleted locally — cloud write failed");
    else toast.success("Transaction deleted");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Loans</h1>
        <p className="mt-1 text-sm text-muted">
          EMI auto-queued each month. Principal reduces outstanding; interest does not. Newest transactions on top.
        </p>
      </div>

      {pendingThisMonth.length > 0 ? (
        <div className="flex gap-3 rounded-lg border border-warn/25 bg-warn-soft px-4 py-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" />
          <div>
            <div className="text-sm font-medium text-warn">
              {pendingThisMonth.length} EMI payment{pendingThisMonth.length > 1 ? "s" : ""} pending this month
            </div>
            <p className="mt-1 text-[13px] text-warn/90">
              Total due {inr(pendingThisMonth.reduce((s, p) => s + p.amount, 0))}. Mark paid after bank debit —
              choose bank account and confirm principal / interest.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loans.map((l) => {
          const fleet = fleets.find((f) => f.id === l.fleetId);
          const lowBalance = l.outstanding > l.principal * 0.9;
          return (
            <Card
              key={l.id}
              className={`cursor-pointer p-4 transition ${selected === l.id ? "ring-2 ring-accent" : ""}`}
              onClick={() => setSelected(l.id)}
            >
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{l.name}</CardTitle>
                {l.status === "active" ? <Badge tone="ok">Active</Badge> : <Badge tone="muted">Closed</Badge>}
              </div>
              <CardHint>
                {l.bank}
                {fleet ? ` · ${fleet.name}` : ""}
              </CardHint>
              <div className="mt-3 font-display text-2xl font-medium tabular-nums tracking-tight">
                {inr(l.outstanding)}
              </div>
              <p className="mt-1 text-[12px] text-muted">
                EMI {inr(l.emiAmount)} · day {l.emiDay} · {l.pendingEmis} left · {l.interestRate}%
              </p>
              {lowBalance && l.status === "active" ? (
                <p className="mt-2 text-[12px] text-warn">High outstanding vs principal</p>
              ) : null}
              <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!window.confirm(`Delete loan "${l.name}" and all its payments?`)) return;
                    removeLoan(l.id);
                    if (selected === l.id) setSelected("");
                    void flushFinanceSave().then((r) => {
                      if (!r.ok) toast.error(r.error || "Deleted locally — cloud write failed");
                      else toast.message("Loan deleted");
                    });
                  }}
                >
                  <Trash2 className="size-3.5" /> Delete loan
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {loan ? (
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <CardTitle>{loan.name}</CardTitle>
              <CardHint>
                A/c {loan.accountNo} · IFSC {loan.ifsc} · Sanction {inr(loan.principal)}
              </CardHint>
              <p className="mt-1 text-[12px] text-muted">
                Outstanding {inr(loan.outstanding)} · rate {loan.interestRate}% p.a.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={openLoanEdit}>
                <Pencil className="size-3.5" /> Edit loan
              </Button>
              <Button onClick={openNewPay}>Record payment</Button>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {rows.length === 0 ? (
              <p className="py-3 text-sm text-muted">No transactions for this loan yet.</p>
            ) : (
              rows.map((p) => {
                const prin = p.principal;
                const int = p.interest;
                const hasSplit = prin != null || int != null;
                return (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line bg-raised/40 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium capitalize">{p.kind}</span>
                        <Badge tone={p.status === "paid" ? "ok" : p.status === "failed" ? "danger" : "warn"}>
                          {p.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[12px] text-muted">
                        {shortDate(p.date)} · {p.mode.toUpperCase()} · {bankName(banks, p.bankAccountId)}
                      </p>
                      {hasSplit ? (
                        <p className="mt-1 text-[12px] text-muted">
                          Principal {inr(prin ?? 0)} · Interest {inr(int ?? 0)}
                        </p>
                      ) : p.kind === "emi" || p.kind === "prepay" ? (
                        <p className="mt-1 text-[12px] text-warn">No P/I split — edit to auto-calculate</p>
                      ) : null}
                      {p.note ? <p className="mt-1 text-[12px] text-subtle">{p.note}</p> : null}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="font-display text-lg font-medium tabular-nums">{inr(p.amount)}</span>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {p.status === "pending" ? (
                          <Button size="sm" variant="outline" onClick={() => markPaid(p.id)}>
                            <Check className="size-3.5" /> Paid
                          </Button>
                        ) : null}
                        <Button size="sm" variant="outline" onClick={() => openEditPay(p)}>
                          <Pencil className="size-3.5" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void deletePay(p.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      ) : null}

      {/* Edit loan account */}
      <Dialog open={loanEditOpen} onOpenChange={setLoanEditOpen}>
        <DialogContent title="Edit loan account">
          <div className="space-y-3 text-left">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Name</Label>
                <Input
                  value={loanForm.name}
                  onChange={(e) => setLoanForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Bank</Label>
                <Input
                  value={loanForm.bank}
                  onChange={(e) => setLoanForm((f) => ({ ...f, bank: e.target.value }))}
                />
              </div>
              <div>
                <Label>Account no.</Label>
                <Input
                  value={loanForm.accountNo}
                  onChange={(e) => setLoanForm((f) => ({ ...f, accountNo: e.target.value }))}
                />
              </div>
              <div>
                <Label>IFSC</Label>
                <Input
                  value={loanForm.ifsc}
                  onChange={(e) => setLoanForm((f) => ({ ...f, ifsc: e.target.value }))}
                />
              </div>
              <div>
                <Label>Sanction / principal (₹)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={loanForm.principal}
                  onChange={(e) => setLoanForm((f) => ({ ...f, principal: e.target.value }))}
                />
              </div>
              <div>
                <Label>Outstanding (₹)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={loanForm.outstanding}
                  onChange={(e) => setLoanForm((f) => ({ ...f, outstanding: e.target.value }))}
                />
              </div>
              <div>
                <Label>EMI amount (₹)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={loanForm.emiAmount}
                  onChange={(e) => setLoanForm((f) => ({ ...f, emiAmount: e.target.value }))}
                />
              </div>
              <div>
                <Label>EMI day (1–31)</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={loanForm.emiDay}
                  onChange={(e) => setLoanForm((f) => ({ ...f, emiDay: e.target.value }))}
                />
              </div>
              <div>
                <Label>Interest rate % p.a.</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={loanForm.interestRate}
                  onChange={(e) => setLoanForm((f) => ({ ...f, interestRate: e.target.value }))}
                />
              </div>
              <div>
                <Label>Pending EMIs</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={loanForm.pendingEmis}
                  onChange={(e) => setLoanForm((f) => ({ ...f, pendingEmis: e.target.value }))}
                />
              </div>
              <div>
                <Label>Total EMIs</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={loanForm.totalEmis}
                  onChange={(e) => setLoanForm((f) => ({ ...f, totalEmis: e.target.value }))}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={loanForm.status}
                  onValueChange={(v) => setLoanForm((f) => ({ ...f, status: v as Loan["status"] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Note</Label>
                <Input
                  value={loanForm.note}
                  onChange={(e) => setLoanForm((f) => ({ ...f, note: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setLoanEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void saveLoanEdit()}>Save loan</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record / edit payment */}
      <Dialog
        open={payOpen}
        onOpenChange={(o) => {
          setPayOpen(o);
          if (!o) setEditingPayId(null);
        }}
      >
        <DialogContent title={editingPayId ? "Edit loan transaction" : "Record loan payment"}>
          <div className="space-y-3 text-left">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Kind</Label>
                <Select value={payKind} onValueChange={(v) => setPayKind(v as LoanPaymentKind)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emi">EMI</SelectItem>
                    <SelectItem value="interest">Interest only</SelectItem>
                    <SelectItem value="prepay">Prepay / principal</SelectItem>
                    <SelectItem value="disbursement">Disbursement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={payStatus} onValueChange={(v) => setPayStatus(v as PayoutStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="lp-amt">Amount (₹)</Label>
                <Input
                  id="lp-amt"
                  type="number"
                  inputMode="decimal"
                  value={payAmount}
                  onChange={(e) => {
                    setPayAmount(e.target.value);
                    setSplitLocked(false);
                    applyAutoSplit(e.target.value, loan);
                  }}
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="lp-date">Date</Label>
                <Input
                  id="lp-date"
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Paid from bank</Label>
                <Select value={payBankId} onValueChange={setPayBankId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank" />
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
                <Label>Mode</Label>
                <Select value={payMode} onValueChange={(v) => setPayMode(v as PayMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(payKind === "emi" || payKind === "prepay") && (
                <>
                  <div>
                    <Label htmlFor="lp-prin">Principal (₹)</Label>
                    <Input
                      id="lp-prin"
                      type="number"
                      inputMode="decimal"
                      value={payPrincipal}
                      onChange={(e) => {
                        setSplitLocked(true);
                        setPayPrincipal(e.target.value);
                      }}
                    />
                    <p className="mt-1 text-[11px] text-muted">Reduces outstanding</p>
                  </div>
                  <div>
                    <Label htmlFor="lp-int">Interest (₹)</Label>
                    <Input
                      id="lp-int"
                      type="number"
                      inputMode="decimal"
                      value={payInterest}
                      onChange={(e) => {
                        setSplitLocked(true);
                        setPayInterest(e.target.value);
                      }}
                    />
                    <p className="mt-1 text-[11px] text-muted">
                      Auto: outstanding × rate/12 · edit if statement differs
                    </p>
                  </div>
                </>
              )}
              <div className="sm:col-span-2">
                <Label htmlFor="lp-note">Note</Label>
                <Input id="lp-note" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
              </div>
            </div>
            {loan && (payKind === "emi" || payKind === "prepay") && payPrincipal !== "" ? (
              <p className="rounded-md bg-accent-soft px-3 py-2 text-[12px] text-ink">
                On save: outstanding − {inr(Number(payPrincipal) || 0)}
                {payInterest !== "" ? ` · interest portion ${inr(Number(payInterest) || 0)} (not cut from principal)` : ""}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPayOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void savePay()}>{editingPayId ? "Save changes" : "Record"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
