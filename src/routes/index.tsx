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
  // Salary slips + extra_route are not bank cash out.
  // Real cash to drivers is recorded as advance.
  const advances = monthPayouts
    .filter((p) => p.kind === "advance" && p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const returnsIn = monthPayouts
    .filter((p) => p.kind === "return" && p.status === "paid")
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
  const bankCash =
    banks.reduce((s, b) => s + b.opening, 0) - advances - expPaid + returnsIn;

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
            <div className="mt-1 text-[12px] text-subtle">Opening − advances − expenses + returns · bank →</div>
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
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Expenses this month</div>
            <div className="mt-2 font-display text-2xl font-medium tabular-nums tracking-tight">{inr(expPaid)}</div>
            <div className="mt-1 text-[12px] text-subtle">Paid · open expenses →</div>
          </Card>
        </Link>

        <Link to="/payouts" className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <Card className="h-full p-4 transition hover:border-accent/40">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Advances this month</div>
            <div className="mt-2 font-display text-2xl font-medium tabular-nums tracking-tight">{inr(advances)}</div>
            <div className="mt-1 text-[12px] text-subtle">Cash to drivers · payouts →</div>
          </Card>
        </Link>
      </div>

      {(pendingAmt > 0 || failedAmt > 0 || pendingEmiAmt > 0) && (
        <Card className="border-warn/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-warn">
                <AlertTriangle className="size-4" /> Held / failed
              </CardTitle>
              <CardHint>
                {pendingPay.length > 0 ? `${pendingPay.length} pending (${inr(pendingAmt)})` : ""}
                {pendingPay.length > 0 && failedPay.length > 0 ? " · " : ""}
                {failedPay.length > 0 ? `${failedPay.length} failed (${inr(failedAmt)})` : ""}
                {pendingEmi.length > 0
                  ? `${pendingPay.length || failedPay.length ? " · " : ""}${pendingEmi.length} EMI pending (${inr(pendingEmiAmt)})`
                  : ""}
              </CardHint>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={clearHeldFailed}>
              Clear held/failed
            </Button>
          </div>
        </Card>
      )}

      {missingUpi.length > 0 ? (
        <Card className="p-4">
          <CardTitle>Missing UPI</CardTitle>
          <CardHint>{missingUpi.map((d) => d.name).join(", ")} — optional on driver card</CardHint>
        </Card>
      ) : null}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-medium">Drivers</h2>
          <Button asChild variant="outline" size="sm">
            <Link to="/drivers">
              All drivers <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
        </div>
        <p className="mb-3 max-w-xl text-[12px] text-muted">
          Balance = opening − advances − fines + returns + salary slips. Extra work is for salary
          deduction only (does not change live balance). Cash paid is advance.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {drivers
            .filter((d) => d.active)
            .map((d) => {
              const leaves =
                attendances.find((a) => a.driverId === d.id && a.month === month)?.leaveDays ?? 0;
              const bal = driverBalance(d, month, payouts, leaves);
              const balClass = bal < 0 ? "text-warn" : bal > 0 ? "text-ink" : "text-muted";
              return (
                <Link
                  key={d.id}
                  to="/drivers"
                  search={{ driver: d.id }}
                  className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Card className="p-4 transition hover:border-accent/40">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-navy text-sm font-medium text-navy-fg">
                        {initials(d.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{d.name}</div>
                        <div className={cn("text-lg font-medium tabular-nums", balClass)}>
                          {inr(Math.abs(bal))}
                          <span className="ml-1 text-[11px] font-normal text-subtle no-underline">balance</span>
                        </div>
                        {d.upiVpa ? (
                          <div className="text-[11px] text-muted">{maskVpa(d.upiVpa)}</div>
                        ) : null}
                      </div>
                      <Wallet className="size-4 text-muted" />
                    </div>
                  </Card>
                </Link>
              );
            })}
        </div>
      </div>
    </div>
  );
}
