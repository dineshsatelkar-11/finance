import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/lib/finance/store";
import { driverBalance, inr, initials, monthISO } from "@/lib/finance/format";
import { maskVpa } from "@/lib/finance/upi";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Overview });

function Overview() {
  const month = useFinance((s) => s.month);
  const setMonth = useFinance((s) => s.setMonth);
  const drivers = useFinance((s) => s.drivers);
  const payouts = useFinance((s) => s.payouts);
  const expenses = useFinance((s) => s.expenses);
  const banks = useFinance((s) => s.banks);
  const loans = useFinance((s) => s.loans);
  const loanPayments = useFinance((s) => s.loanPayments);
  const attendances = useFinance((s) => s.attendances);
  const clearHeldOrFailedPayouts = useFinance((s) => s.clearHeldOrFailedPayouts);

  const monthPayouts = payouts.filter((p) => p.date.startsWith(month));
  const monthExp = expenses.filter((e) => e.date.startsWith(month));
  const salaryPaid = monthPayouts
    .filter((p) => p.kind === "salary" && p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const advances = monthPayouts
    .filter((p) => p.kind === "advance" && p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const extra = monthPayouts
    .filter((p) => p.kind === "extra_route" && p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const expPaid = monthExp.filter((e) => e.status === "paid").reduce((s, e) => s + e.amount, 0);
  const pendingPay = monthPayouts.filter((p) => p.status === "pending");
  const failedPay = monthPayouts.filter((p) => p.status === "failed");
  const pendingAmt = pendingPay.reduce((s, p) => s + p.amount, 0);
  const failedAmt = failedPay.reduce((s, p) => s + p.amount, 0);
  const missingUpi = drivers.filter((d) => d.active && !d.upiVpa);
  const activeLoans = loans.filter((l) => l.status === "active");
  const loanOut = activeLoans.reduce((s, l) => s + l.outstanding, 0);
  const pendingEmi = loanPayments.filter(
    (p) => p.kind === "emi" && p.status === "pending" && p.date.startsWith(month),
  );
  const pendingEmiAmt = pendingEmi.reduce((s, p) => s + p.amount, 0);
  const bankCash = banks.reduce((s, b) => s + b.opening, 0) - salaryPaid - advances - extra - expPaid;

  function clearHeldFailed() {
    const n = clearHeldOrFailedPayouts(month);
    if (n === 0) {
      toast.message("No held or failed payouts to clear");
      return;
    }
    toast.success(`Cleared ${n} held/failed payout(s)`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-ink">Overview</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Driver balances and cash movement for IBCAB operations.
          </p>
        </div>
        <label className="text-sm text-muted">
          Month
          <input
            type="month"
            className="ml-2 h-11 rounded-md border border-line bg-raised px-3 text-sm text-ink"
            value={month}
            onChange={(e) => setMonth(e.target.value || monthISO())}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link to="/bank" className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <Card className="h-full p-4 transition hover:border-accent/40">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Cash position</div>
            <div className="mt-2 font-display text-2xl font-medium tabular-nums tracking-tight">{inr(bankCash)}</div>
            <div className="mt-1 text-[12px] text-subtle">Opening less paid out · bank →</div>
          </Card>
        </Link>

        <Link to="/loans" className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <Card className="h-full p-4 transition hover:border-accent/40">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Loan outstanding</div>
            <div className="mt-2 font-display text-2xl font-medium tabular-nums tracking-tight">{inr(loanOut)}</div>
            <div className="mt-1 text-[12px] text-subtle">{activeLoans.length} active · open loans →</div>
          </Card>
        </Link>

        <Link to="/expenses" className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <Card className="h-full p-4 transition hover:border-accent/40">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Expenses</div>
            <div className="mt-2 font-display text-2xl font-medium tabular-nums tracking-tight">{inr(expPaid)}</div>
            <div className="mt-1 text-[12px] text-subtle">Fuel, packaging · open expenses →</div>
          </Card>
        </Link>

        <a
          href="/payouts?status=pending"
          className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Card className="h-full p-4 transition hover:border-accent/40">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Held payouts</div>
            <div className="mt-2 font-display text-2xl font-medium tabular-nums tracking-tight">{inr(pendingAmt)}</div>
            <div className="mt-1 text-[12px] text-subtle">{pendingPay.length} awaiting confirm →</div>
          </Card>
        </a>
      </div>

      {pendingEmi.length > 0 ? (
        <div className="flex gap-3 rounded-lg border border-warn/25 bg-warn-soft px-4 py-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-warn">EMI due this month — {inr(pendingEmiAmt)}</div>
            <p className="mt-1 text-[13px] text-warn/90">
              {pendingEmi.length} installment(s) queued. Confirm after bank debit to reduce outstanding.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3 border-warn/30 bg-panel">
              <Link to="/loans">
                Open loans <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      {missingUpi.length > 0 ? (
        <div className="flex gap-3 rounded-lg border border-line bg-raised px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-ink">
              Optional: add UPI for {missingUpi.map((d) => d.name).join(", ")}
            </div>
            <p className="mt-1 text-[13px] text-muted">
              One-time — when you pay, you can save UPI on the driver. Not required on cards.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link to="/drivers">
                Drivers <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Drivers</CardTitle>
          <CardHint>Balance = opening − paid (advances etc.) + fines − returns. Salary is not included — settle at month end. Tap amount for transactions.</CardHint>
          <ul className="mt-4 divide-y divide-line">
            {drivers
              .filter((d) => d.active)
              .map((d) => {
                const leaves =
                  attendances.find((a) => a.driverId === d.id && a.month === month)?.leaveDays || 0;
                const bal = driverBalance(d, month, payouts, leaves);
                return (
                  <li key={d.id} className="flex items-center gap-3 py-3">
                    <div className="flex size-10 items-center justify-center rounded-md bg-navy text-sm font-medium text-navy-fg">
                      {initials(d.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{d.name}</span>
                        {d.upiVpa ? <Badge tone="ok">UPI</Badge> : null}
                      </div>
                      <div className="truncate text-[12px] text-muted">
                        {d.upiVpa ? maskVpa(d.upiVpa) : "—"}
                      </div>
                    </div>
                    <a
                      href={`/payouts?driver=${encodeURIComponent(d.id)}`}
                      className={cn(
                        "text-right text-sm tabular-nums font-medium underline-offset-2 hover:underline",
                        bal > 0 ? "text-warn" : bal < 0 ? "text-ok" : "text-muted",
                      )}
                    >
                      <div>{inr(bal)}</div>
                      <div className="text-[11px] font-normal text-subtle no-underline">balance</div>
                    </a>
                  </li>
                );
              })}
          </ul>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Needs confirmation</CardTitle>
              <CardHint>Held & failed only — Clear removes those rows, not paid ones.</CardHint>
            </div>
            <div className="flex flex-wrap gap-2">
              {(pendingPay.length > 0 || failedPay.length > 0) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Clear ${pendingPay.length} held and ${failedPay.length} failed payout(s) for this month? Paid amounts stay.`,
                      )
                    ) {
                      return;
                    }
                    clearHeldFailed();
                  }}
                >
                  Clear held/failed
                </Button>
              )}
              <Button asChild size="sm">
                <Link to="/payouts">
                  <Wallet className="size-4" /> Pay
                </Link>
              </Button>
            </div>
          </div>
          {pendingPay.length === 0 && failedPay.length === 0 ? (
            <p className="mt-6 text-sm text-muted">No held or failed payouts this month.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {[...pendingPay, ...failedPay].map((p) => {
                const d = drivers.find((x) => x.id === p.driverId);
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-md border border-line bg-raised px-3 py-2.5"
                  >
                    <div>
                      <div className="text-sm font-medium">{d?.name}</div>
                      <div className="text-[12px] capitalize text-muted">
                        {p.kind.replace("_", " ")} · {p.status}
                      </div>
                    </div>
                    <div className="text-sm font-medium tabular-nums">{inr(p.amount)}</div>
                  </li>
                );
              })}
              {failedAmt > 0 ? (
                <li className="text-[12px] text-muted">Failed total {inr(failedAmt)}</li>
              ) : null}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
