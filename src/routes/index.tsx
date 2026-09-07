import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, Wallet } from "lucide-react";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/lib/finance/store";
import { inr, initials, monthISO } from "@/lib/finance/format";
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
  const pendingAmt = pendingPay.reduce((s, p) => s + p.amount, 0);
  const missingUpi = drivers.filter((d) => d.active && !d.upiVpa);
  const bankCash = banks.reduce((s, b) => s + b.opening, 0) - salaryPaid - advances - extra - expPaid;

  const stats = [
    { label: "Cash position", value: inr(bankCash), hint: "Opening less paid out" },
    { label: "Salary paid", value: inr(salaryPaid), hint: "This month" },
    { label: "Expenses", value: inr(expPaid), hint: "Fuel, packaging, other" },
    { label: "Held payouts", value: inr(pendingAmt), hint: `${pendingPay.length} awaiting confirm` },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-ink">Overview</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Driver payouts, UPI on file, and cash movement for IBCAB operations.
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
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{s.label}</div>
            <div className="mt-2 font-display text-2xl font-medium tabular-nums tracking-tight">{s.value}</div>
            <div className="mt-1 text-[12px] text-subtle">{s.hint}</div>
          </Card>
        ))}
      </div>

      {missingUpi.length > 0 ? (
        <div className="flex gap-3 rounded-lg border border-warn/25 bg-warn-soft px-4 py-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-warn">
              {missingUpi.length} driver{missingUpi.length > 1 ? "s" : ""} missing a UPI ID
            </div>
            <p className="mt-1 text-[13px] text-warn/90">
              {missingUpi.map((d) => d.name).join(", ")} — payouts used to fail because UPI was only stored on this
              phone. Add the ID on the driver record, then pay.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3 border-warn/30 bg-panel">
              <Link to="/drivers">
                Fix UPI IDs <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Drivers</CardTitle>
          <CardHint>UPI is stored on each driver — not a side list on one phone.</CardHint>
          <ul className="mt-4 divide-y divide-line">
            {drivers
              .filter((d) => d.active)
              .map((d) => {
                const due = monthPayouts
                  .filter((p) => p.driverId === d.id && p.status === "pending")
                  .reduce((s, p) => s + p.amount, 0);
                return (
                  <li key={d.id} className="flex items-center gap-3 py-3">
                    <div className="flex size-10 items-center justify-center rounded-md bg-navy text-sm font-medium text-navy-fg">
                      {initials(d.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{d.name}</span>
                        {d.upiVpa ? <Badge tone="ok">UPI</Badge> : <Badge tone="warn">No UPI</Badge>}
                      </div>
                      <div className="truncate text-[12px] text-muted">
                        {d.upiVpa ? maskVpa(d.upiVpa) : "Add UPI before paying"}
                      </div>
                    </div>
                    <div className={cn("text-right text-sm tabular-nums", due > 0 ? "text-warn" : "text-muted")}>
                      {due > 0 ? inr(due) : d.kind === "full" ? inr(d.baseSalary) : `${inr(d.dailyRate)}/d`}
                    </div>
                  </li>
                );
              })}
          </ul>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Needs confirmation</CardTitle>
              <CardHint>UPI is never auto-marked paid when an app opens.</CardHint>
            </div>
            <Button asChild size="sm">
              <Link to="/payouts">
                <Wallet className="size-4" /> Pay
              </Link>
            </Button>
          </div>
          {pendingPay.length === 0 ? (
            <p className="mt-6 text-sm text-muted">No held payouts this month.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {pendingPay.map((p) => {
                const d = drivers.find((x) => x.id === p.driverId);
                return (
                  <li key={p.id} className="flex items-center justify-between rounded-md border border-line bg-raised px-3 py-2.5">
                    <div>
                      <div className="text-sm font-medium">{d?.name}</div>
                      <div className="text-[12px] capitalize text-muted">{p.kind.replace("_", " ")}</div>
                    </div>
                    <div className="text-sm font-medium tabular-nums">{inr(p.amount)}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
