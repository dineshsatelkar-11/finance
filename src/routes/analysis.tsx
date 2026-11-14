import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Landmark,
  Receipt,
  TrendingDown,
  TrendingUp,
  Truck,
  Wallet,
} from "lucide-react";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/lib/finance/store";
import { inr, initials, monthISO, monthLabel, shortDate } from "@/lib/finance/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analysis")({ component: AnalysisDashboard });

/** Running balance: opening − advances + returns − fines + salary slips (paid). */
function driverBalance(
  driver: { id: string; openingBalance?: number },
  payouts: { driverId: string; kind: string; amount: number; status: string; date: string }[],
  throughDate?: string,
) {
  const opening = Number(driver.openingBalance) || 0;
  let advances = 0;
  let fine = 0;
  let returned = 0;
  let salaryAccrued = 0;
  for (const p of payouts) {
    if (p.driverId !== driver.id || p.status !== "paid") continue;
    const d = String(p.date || "").slice(0, 10);
    if (throughDate && d && d > throughDate) continue;
    if (p.kind === "fine") fine += p.amount;
    else if (p.kind === "return") returned += p.amount;
    else if (p.kind === "advance") advances += p.amount;
    else if (p.kind === "salary") salaryAccrued += p.amount;
  }
  return Math.round((opening - advances + returned - fine + salaryAccrued) * 100) / 100;
}

function bankLedgerBalance(
  bank: { id: string; opening: number },
  opts: {
    payouts: { bankAccountId?: string; amount: number; status: string; kind: string }[];
    expenses: { bankAccountId?: string; amount: number; status: string }[];
    receipts: { bankAccountId?: string; amount: number; status: string }[];
    loanPayments: { bankAccountId?: string; amount: number; status: string }[];
    transfers: { fromBankId: string; toBankId: string; amount: number }[];
  },
) {
  let bal = Number(bank.opening) || 0;
  for (const p of opts.payouts) {
    if (p.status !== "paid") continue;
    if (p.kind === "salary" || p.kind === "extra_route") continue;
    if (p.bankAccountId === bank.id) bal -= p.amount;
  }
  for (const e of opts.expenses) {
    if (e.status === "paid" && e.bankAccountId === bank.id) bal -= e.amount;
  }
  for (const r of opts.receipts) {
    if (r.status === "paid" && r.bankAccountId === bank.id) bal += r.amount;
  }
  for (const lp of opts.loanPayments) {
    if (lp.status === "paid" && lp.bankAccountId === bank.id) bal -= lp.amount;
  }
  for (const t of opts.transfers) {
    if (t.fromBankId === bank.id) bal -= t.amount;
    if (t.toBankId === bank.id) bal += t.amount;
  }
  return Math.round(bal * 100) / 100;
}

function BarRow({
  label,
  value,
  max,
  tone = "navy",
}: {
  label: string;
  value: number;
  max: number;
  tone?: "navy" | "ok" | "warn" | "muted";
}) {
  const pct = max > 0 ? Math.min(100, Math.round((Math.abs(value) / max) * 100)) : 0;
  const bar =
    tone === "ok"
      ? "bg-emerald-600"
      : tone === "warn"
        ? "bg-amber-500"
        : tone === "muted"
          ? "bg-slate-400"
          : "bg-navy";
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate text-ink">{label}</span>
        <span className="shrink-0 tabular-nums font-medium text-ink">{inr(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-raised">
        <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function AnalysisDashboard() {
  const month = useFinance((s) => s.month);
  const setMonth = useFinance((s) => s.setMonth);
  const drivers = useFinance((s) => s.drivers);
  const payouts = useFinance((s) => s.payouts);
  const expenses = useFinance((s) => s.expenses);
  const banks = useFinance((s) => s.banks);
  const loans = useFinance((s) => s.loans);
  const loanPayments = useFinance((s) => s.loanPayments);
  const bankTransfers = useFinance((s) => s.bankTransfers);
  const receipts = useFinance((s) => s.receipts);
  const fleets = useFinance((s) => s.fleets);
  const rentPayments = useFinance((s) => s.rentPayments);

  const today = new Date().toISOString().slice(0, 10);

  const monthPayouts = payouts.filter((p) => p.date.startsWith(month));
  const monthExp = expenses.filter((e) => e.date.startsWith(month));
  const monthReceipts = receipts.filter((r) => r.date.startsWith(month));
  const monthLoanPay = loanPayments.filter((p) => p.date.startsWith(month));
  const monthRent = rentPayments.filter((r) => r.date.startsWith(month) || r.forMonth === month);
  const monthTransfers = bankTransfers.filter((t) => t.date.startsWith(month));

  const salarySlips = monthPayouts
    .filter((p) => p.kind === "salary" && p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const advancesPaid = monthPayouts
    .filter((p) => p.kind === "advance" && p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const extraPaid = monthPayouts
    .filter((p) => p.kind === "extra_route" && p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const bonusPaid = monthPayouts
    .filter((p) => p.kind === "bonus" && p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const fines = monthPayouts
    .filter((p) => p.kind === "fine" && p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const returns = monthPayouts
    .filter((p) => p.kind === "return" && p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);

  const expPaid = monthExp.filter((e) => e.status === "paid").reduce((s, e) => s + e.amount, 0);
  const incomeIn = monthReceipts.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0);
  const rentIn = monthRent.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0);
  const emiPaid = monthLoanPay.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const pendingPayAmt = monthPayouts.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);

  const bankOpts = {
    payouts: payouts as { bankAccountId?: string; amount: number; status: string; kind: string }[],
    expenses: expenses as { bankAccountId?: string; amount: number; status: string }[],
    receipts: receipts as { bankAccountId?: string; amount: number; status: string }[],
    loanPayments: loanPayments as { bankAccountId?: string; amount: number; status: string }[],
    transfers: bankTransfers,
  };
  const bankRows = banks.map((b) => ({
    ...b,
    balance: bankLedgerBalance(b, bankOpts),
  }));
  const totalBank = bankRows.reduce((s, b) => s + b.balance, 0);

  const activeDrivers = drivers.filter((d) => d.active);
  const driverRows = activeDrivers
    .map((d) => ({
      driver: d,
      balance: driverBalance(d, payouts, today),
      monthAdv: monthPayouts
        .filter((p) => p.driverId === d.id && p.kind === "advance" && p.status === "paid")
        .reduce((s, p) => s + p.amount, 0),
      monthSalary: monthPayouts
        .filter((p) => p.driverId === d.id && p.kind === "salary" && p.status === "paid")
        .reduce((s, p) => s + p.amount, 0),
    }))
    .sort((a, b) => a.balance - b.balance);
  const totalDriverBal = driverRows.reduce((s, r) => s + r.balance, 0);

  const catMap = new Map<string, number>();
  for (const e of monthExp) {
    if (e.status !== "paid") continue;
    const cat = e.category || "Other";
    catMap.set(cat, (catMap.get(cat) || 0) + e.amount);
  }
  const catRows = [...catMap.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const catMax = catRows[0]?.value || 1;

  const kindLabels: Record<string, string> = {
    salary: "Salary slips",
    advance: "Advances",
    extra_route: "Extra work",
    bonus: "Bonus",
    fine: "Fines",
    return: "Returns",
  };
  const kindMap = new Map<string, number>();
  for (const p of monthPayouts) {
    if (p.status !== "paid") continue;
    kindMap.set(p.kind, (kindMap.get(p.kind) || 0) + p.amount);
  }
  const kindRows = [...kindMap.entries()]
    .map(([k, value]) => ({ label: kindLabels[k] || k, value, kind: k }))
    .sort((a, b) => b.value - a.value);
  const kindMax = kindRows[0]?.value || 1;

  const activeLoans = loans.filter((l) => l.status === "active");
  const loanOut = activeLoans.reduce((s, l) => s + l.outstanding, 0);
  const pendingEmi = loanPayments.filter(
    (p) => p.kind === "emi" && p.status === "pending" && p.date.startsWith(month),
  );
  const pendingEmiAmt = pendingEmi.reduce((s, p) => s + p.amount, 0);

  const monthKeys = new Set<string>();
  for (const p of payouts) if (p.date?.length >= 7) monthKeys.add(p.date.slice(0, 7));
  for (const e of expenses) if (e.date?.length >= 7) monthKeys.add(e.date.slice(0, 7));
  for (const r of receipts) if (r.date?.length >= 7) monthKeys.add(r.date.slice(0, 7));
  const sortedMonths = [...monthKeys].sort().slice(-6);
  const trend = sortedMonths.map((ym) => {
    const exp = expenses
      .filter((e) => e.date.startsWith(ym) && e.status === "paid")
      .reduce((s, e) => s + e.amount, 0);
    const adv = payouts
      .filter((p) => p.date.startsWith(ym) && p.kind === "advance" && p.status === "paid")
      .reduce((s, p) => s + p.amount, 0);
    const sal = payouts
      .filter((p) => p.date.startsWith(ym) && p.kind === "salary" && p.status === "paid")
      .reduce((s, p) => s + p.amount, 0);
    const inc = receipts
      .filter((r) => r.date.startsWith(ym) && r.status === "paid")
      .reduce((s, r) => s + r.amount, 0);
    return { ym, exp, adv, sal, inc, out: exp + adv };
  });
  const trendMax = Math.max(1, ...trend.map((t) => Math.max(t.out, t.inc, t.sal)));

  const cashOut = expPaid + advancesPaid + emiPaid;
  const cashIn = incomeIn + rentIn;
  const netMonth = cashIn - cashOut;

  const kpis = [
    {
      label: "Bank cash",
      value: inr(totalBank),
      hint: `${banks.length} account(s)`,
      icon: Banknote,
      to: "/bank",
    },
    {
      label: "Month income",
      value: inr(cashIn),
      hint: "Receipts + rent",
      icon: TrendingUp,
      to: "/receipts",
    },
    {
      label: "Month spend",
      value: inr(cashOut),
      hint: "Expenses + advances + EMI",
      icon: TrendingDown,
      to: "/expenses",
    },
    {
      label: "Net (cash)",
      value: inr(netMonth),
      hint: netMonth >= 0 ? "Inflow ≥ outflow" : "Outflow heavier",
      icon: BarChart3,
      to: "/analysis",
    },
    {
      label: "Driver balances",
      value: inr(totalDriverBal),
      hint: totalDriverBal >= 0 ? "Company owes net" : "Drivers owe net",
      icon: Truck,
      to: "/drivers",
    },
    {
      label: "Loan outstanding",
      value: inr(loanOut),
      hint: `${activeLoans.length} active · EMI pending ${inr(pendingEmiAmt)}`,
      icon: Landmark,
      to: "/loans",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title text-ink">Analysis</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            One view of cash, drivers, spend, income, and loans for {monthLabel(month)}.
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Link key={k.label} to={k.to} className="block">
              <Card className="h-full p-4 transition hover:border-navy/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                    {k.label}
                  </div>
                  <Icon className="size-4 shrink-0 text-muted" />
                </div>
                <div
                  className={cn(
                    "mt-2 font-display text-xl font-medium tabular-nums tracking-tight sm:text-2xl",
                    k.label === "Net (cash)" && netMonth < 0 && "text-warn",
                    k.label === "Net (cash)" && netMonth >= 0 && "text-emerald-700",
                  )}
                >
                  {k.value}
                </div>
                <div className="mt-1 text-[12px] text-subtle">{k.hint}</div>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card className="p-4">
        <CardTitle>This month · cash flow</CardTitle>
        <CardHint>Money in vs money out (excludes salary slips & extra-work balance entries).</CardHint>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-md border border-line bg-raised px-3 py-2.5">
            <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted">
              <ArrowDownRight className="size-3.5 text-emerald-600" /> In
            </div>
            <div className="mt-1 text-lg font-medium tabular-nums text-emerald-700">{inr(cashIn)}</div>
            <div className="text-[11px] text-subtle">
              Receipts {inr(incomeIn)} · Rent {inr(rentIn)}
            </div>
          </div>
          <div className="rounded-md border border-line bg-raised px-3 py-2.5">
            <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted">
              <ArrowUpRight className="size-3.5 text-amber-600" /> Out
            </div>
            <div className="mt-1 text-lg font-medium tabular-nums text-ink">{inr(cashOut)}</div>
            <div className="text-[11px] text-subtle">
              Exp {inr(expPaid)} · Adv {inr(advancesPaid)} · EMI {inr(emiPaid)}
            </div>
          </div>
          <div className="rounded-md border border-line bg-raised px-3 py-2.5">
            <div className="text-[11px] uppercase tracking-wide text-muted">Salary slips</div>
            <div className="mt-1 text-lg font-medium tabular-nums">{inr(salarySlips)}</div>
            <div className="text-[11px] text-subtle">Balance only · not bank cash</div>
          </div>
          <div className="rounded-md border border-line bg-raised px-3 py-2.5">
            <div className="text-[11px] uppercase tracking-wide text-muted">Held payouts</div>
            <div className="mt-1 text-lg font-medium tabular-nums text-warn">{inr(pendingPayAmt)}</div>
            <div className="text-[11px] text-subtle">Awaiting confirm</div>
          </div>
        </div>
        {(extraPaid > 0 || bonusPaid > 0 || fines > 0 || returns > 0) && (
          <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-muted">
            {extraPaid > 0 && <Badge tone="ok">Extra work {inr(extraPaid)}</Badge>}
            {bonusPaid > 0 && <Badge>Bonus {inr(bonusPaid)}</Badge>}
            {fines > 0 && <Badge tone="warn">Fines {inr(fines)}</Badge>}
            {returns > 0 && <Badge>Returns {inr(returns)}</Badge>}
            {monthTransfers.length > 0 && (
              <Badge>
                Transfers {monthTransfers.length} ·{" "}
                {inr(monthTransfers.reduce((s, t) => s + t.amount, 0))}
              </Badge>
            )}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>Expenses by category</CardTitle>
              <CardHint>Paid in {monthLabel(month)}</CardHint>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/expenses">
                <Receipt className="size-4" /> Spend
              </Link>
            </Button>
          </div>
          {catRows.length === 0 ? (
            <p className="mt-6 text-sm text-muted">No paid expenses this month.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {catRows.map((r) => (
                <BarRow key={r.label} label={r.label} value={r.value} max={catMax} tone="navy" />
              ))}
              <div className="border-t border-line pt-2 text-right text-sm font-medium tabular-nums">
                Total {inr(expPaid)}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>Payouts by type</CardTitle>
              <CardHint>Paid in {monthLabel(month)}</CardHint>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/payouts">
                <Wallet className="size-4" /> Pay
              </Link>
            </Button>
          </div>
          {kindRows.length === 0 ? (
            <p className="mt-6 text-sm text-muted">No paid payouts this month.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {kindRows.map((r) => (
                <BarRow
                  key={r.kind}
                  label={r.label}
                  value={r.value}
                  max={kindMax}
                  tone={r.kind === "fine" ? "warn" : r.kind === "return" ? "ok" : "navy"}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Driver balances</CardTitle>
            <CardHint>
              Positive = we owe · Negative = over-advanced. Till {shortDate(today)}.
            </CardHint>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/drivers">
              <Truck className="size-4" /> Drivers
            </Link>
          </Button>
        </div>
        <ul className="mt-4 divide-y divide-line">
          {driverRows.map(({ driver: d, balance, monthAdv, monthSalary }) => (
            <li key={d.id} className="flex items-center gap-3 py-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-navy text-sm font-medium text-navy-fg">
                {initials(d.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-ink">{d.name}</div>
                <div className="truncate text-[12px] text-muted">
                  {monthSalary > 0 && `Slip ${inr(monthSalary)}`}
                  {monthSalary > 0 && monthAdv > 0 && " · "}
                  {monthAdv > 0 && `Adv ${inr(monthAdv)}`}
                  {monthSalary === 0 && monthAdv === 0 && (d.kind === "full" ? "Full time" : "Part time")}
                </div>
              </div>
              <div
                className={cn(
                  "text-right text-sm font-medium tabular-nums",
                  balance < 0 ? "text-warn" : balance > 0 ? "text-emerald-700" : "text-muted",
                )}
              >
                {inr(balance)}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex justify-between border-t border-line pt-3 text-sm">
          <span className="text-muted">Net all drivers</span>
          <span
            className={cn(
              "font-medium tabular-nums",
              totalDriverBal < 0 ? "text-warn" : totalDriverBal > 0 ? "text-emerald-700" : "text-ink",
            )}
          >
            {inr(totalDriverBal)}
          </span>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>Bank positions</CardTitle>
              <CardHint>Opening ± paid flows & transfers</CardHint>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/bank">Bank</Link>
            </Button>
          </div>
          <ul className="mt-4 space-y-2">
            {bankRows.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between rounded-md border border-line bg-raised px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{b.name}</div>
                  {b.isDefault && (
                    <span className="text-[11px] text-muted">Default</span>
                  )}
                </div>
                <div
                  className={cn(
                    "text-sm font-medium tabular-nums",
                    b.balance < 0 ? "text-warn" : "text-ink",
                  )}
                >
                  {inr(b.balance)}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-line pt-3 text-sm">
            <span className="text-muted">Total</span>
            <span className={cn("font-medium tabular-nums", totalBank < 0 && "text-warn")}>
              {inr(totalBank)}
            </span>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>Loans</CardTitle>
              <CardHint>
                {activeLoans.length} active · outstanding {inr(loanOut)}
              </CardHint>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/loans">Loans</Link>
            </Button>
          </div>
          {activeLoans.length === 0 ? (
            <p className="mt-6 text-sm text-muted">No active loans.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {activeLoans.map((l) => {
                const fleet = fleets.find((f) => f.id === l.fleetId);
                return (
                  <li
                    key={l.id}
                    className="rounded-md border border-line bg-raised px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{l.name}</div>
                        <div className="text-[12px] text-muted">
                          EMI {inr(l.emiAmount)} · day {l.emiDay}
                          {fleet ? ` · ${fleet.name}` : ""}
                        </div>
                      </div>
                      <div className="text-right text-sm font-medium tabular-nums">
                        {inr(l.outstanding)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {pendingEmi.length > 0 && (
            <div className="mt-3 rounded-md border border-warn/25 bg-warn-soft px-3 py-2 text-sm text-warn">
              {pendingEmi.length} EMI pending · {inr(pendingEmiAmt)}
            </div>
          )}
        </Card>
      </div>

      {trend.length > 0 && (
        <Card className="p-4">
          <CardTitle>Trend · last months</CardTitle>
          <CardHint>Expenses + advances (out) vs receipts (in) vs salary slips</CardHint>
          <div className="mt-4 space-y-4">
            {trend.map((t) => (
              <div key={t.ym} className="space-y-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium text-ink">{monthLabel(t.ym)}</span>
                  <span className="text-[12px] text-muted">
                    Out {inr(t.out)} · In {inr(t.inc)} · Slips {inr(t.sal)}
                  </span>
                </div>
                <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-raised">
                  <div
                    className="h-full bg-navy/80"
                    style={{ width: `${Math.round((t.exp / trendMax) * 100)}%` }}
                    title={`Expenses ${inr(t.exp)}`}
                  />
                  <div
                    className="h-full bg-amber-500/90"
                    style={{ width: `${Math.round((t.adv / trendMax) * 100)}%` }}
                    title={`Advances ${inr(t.adv)}`}
                  />
                  <div
                    className="h-full bg-emerald-600/80"
                    style={{ width: `${Math.round((t.inc / trendMax) * 100)}%` }}
                    title={`Income ${inr(t.inc)}`}
                  />
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-3 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-sm bg-navy/80" /> Expenses
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-sm bg-amber-500" /> Advances
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-sm bg-emerald-600" /> Receipts
              </span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
