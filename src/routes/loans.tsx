import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, Check } from "lucide-react";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { defaultBankId, useFinance } from "@/lib/finance/store";
import { inr, shortDate, todayISO } from "@/lib/finance/format";
import type { PayMode } from "@/lib/finance/types";

export const Route = createFileRoute("/loans")({ component: LoansPage });

function LoansPage() {
  const loans = useFinance((s) => s.loans);
  const loanPayments = useFinance((s) => s.loanPayments);
  const fleets = useFinance((s) => s.fleets);
  const month = useFinance((s) => s.month);
  const recordLoanPayment = useFinance((s) => s.recordLoanPayment);
  const ensureMonthlyEmi = useFinance((s) => s.ensureMonthlyEmi);

  const [selected, setSelected] = useState(loans[0]?.id || "");
  const loan = loans.find((l) => l.id === selected) || loans[0];

  useEffect(() => {
    for (const l of loans) {
      if (l.status === "active") ensureMonthlyEmi(l.id);
    }
  }, [loans, month, ensureMonthlyEmi]);

  const rows = useMemo(
    () =>
      loanPayments
        .filter((p) => !loan || p.loanId === loan.id)
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date)),
    [loanPayments, loan],
  );

  const pendingThisMonth = loanPayments.filter(
    (p) => p.kind === "emi" && p.status === "pending" && p.date.startsWith(month),
  );

  function markPaid(id: string) {
    const p = loanPayments.find((x) => x.id === id);
    if (!p) return;
    // pending EMI was stored without reducing balance — record as paid + reduce
    useFinance.setState((s) => ({
      loanPayments: s.loanPayments.map((x) => (x.id === id ? { ...x, status: "paid" as const } : x)),
      loans: s.loans.map((l) => {
        if (l.id !== p.loanId || p.kind !== "emi") return l;
        const outstanding = Math.max(0, Math.round((l.outstanding - p.amount) * 100) / 100);
        return {
          ...l,
          outstanding,
          pendingEmis: Math.max(0, l.pendingEmis - 1),
          status: outstanding <= 0 ? ("closed" as const) : l.status,
        };
      }),
    }));
    toast.success("EMI marked paid — outstanding reduced");
  }

  function payEmiNow() {
    if (!loan) return;
    const r = recordLoanPayment({
      loanId: loan.id,
      kind: "emi",
      amount: loan.emiAmount,
      date: todayISO(),
      mode: "bank",
      bankAccountId: defaultBankId(),
      note: "EMI paid",
      reduceBalance: true,
    });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(`EMI ${inr(loan.emiAmount)} recorded · balance reduced`);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Loans</h1>
        <p className="mt-1 text-sm text-muted">
          EMI auto-queued each month. Confirm payment to cut outstanding. Alerts when balance is high or EMI is due.
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
              Total due {inr(pendingThisMonth.reduce((s, p) => s + p.amount, 0))}. Mark paid after bank debit.
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
            </Card>
          );
        })}
      </div>

      {loan ? (
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle>{loan.name}</CardTitle>
              <CardHint>
                A/c {loan.accountNo} · IFSC {loan.ifsc} · Sanction {inr(loan.principal)}
              </CardHint>
            </div>
            <Button onClick={payEmiNow}>Record EMI paid today</Button>
          </div>
          <ul className="mt-4 divide-y divide-line">
            {rows.slice(0, 15).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <div className="font-medium capitalize">
                    {p.kind} · {shortDate(p.date)}
                  </div>
                  <div className="text-[12px] text-muted">
                    {p.note || p.mode.toUpperCase()}
                    {p.status === "pending" ? " · awaiting confirm" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums font-medium">{inr(p.amount)}</span>
                  {p.status === "pending" ? (
                    <Button size="sm" variant="outline" onClick={() => markPaid(p.id)}>
                      <Check className="size-3.5" /> Paid
                    </Button>
                  ) : (
                    <Badge tone="ok">Paid</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
