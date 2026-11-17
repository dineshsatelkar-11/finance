import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Printer,
  Filter,
  Truck,
  Receipt,
  Wallet,
  Landmark,
  HandCoins,
  Banknote,
  LayoutList,
} from "lucide-react";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/lib/finance/store";
import { inr, shortDate, todayISO } from "@/lib/finance/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

type ReportKind =
  | "summary"
  | "expenses"
  | "drivers"
  | "payouts"
  | "receipts"
  | "loans"
  | "bank";

const REPORTS: { id: ReportKind; label: string; icon: typeof Receipt; hint: string }[] = [
  { id: "summary", label: "Full summary", icon: LayoutList, hint: "P&L style overview for the range" },
  { id: "expenses", label: "Expenses", icon: Receipt, hint: "All spends by category & vendor" },
  { id: "drivers", label: "Drivers", icon: Truck, hint: "Balances, advances, salary in range" },
  { id: "payouts", label: "Payouts", icon: Wallet, hint: "Advances, salary slips, extra work" },
  { id: "receipts", label: "Receipts", icon: HandCoins, hint: "Customer collections / income" },
  { id: "loans", label: "Loan payments", icon: Landmark, hint: "EMI & loan payments" },
  { id: "bank", label: "Bank transfers", icon: Banknote, hint: "Internal account transfers" },
];

function monthStartISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function inRange(date: string, from: string, to: string) {
  const d = String(date || "").slice(0, 10);
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function csvEscape(v: string | number) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const body = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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

const KIND_LABEL: Record<string, string> = {
  salary: "Salary slip",
  advance: "Advance",
  extra_route: "Extra work",
  bonus: "Bonus",
  fine: "Fine",
  return: "Return",
  emi: "EMI",
  interest: "Interest",
  prepay: "Prepay",
  disbursement: "Disbursement",
};

function ReportsPage() {
  const drivers = useFinance((s) => s.drivers);
  const payouts = useFinance((s) => s.payouts);
  const expenses = useFinance((s) => s.expenses);
  const banks = useFinance((s) => s.banks);
  const loans = useFinance((s) => s.loans);
  const loanPayments = useFinance((s) => s.loanPayments);
  const bankTransfers = useFinance((s) => s.bankTransfers);
  const receipts = useFinance((s) => s.receipts);

  const [kind, setKind] = useState<ReportKind>("summary");
  const [from, setFrom] = useState(monthStartISO);
  const [to, setTo] = useState(todayISO());
  const [driverFilter, setDriverFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("paid");

  const bankName = (id: string) => banks.find((b) => b.id === id)?.name || id || "—";
  const driverName = (id: string) => drivers.find((d) => d.id === id)?.name || id || "—";
  const loanName = (id: string) => loans.find((l) => l.id === id)?.name || id || "—";

  const filtered = useMemo(() => {
    const exp = expenses
      .filter((e) => inRange(e.date, from, to))
      .filter((e) => !statusFilter || e.status === statusFilter)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    const pay = payouts
      .filter((p) => inRange(p.date, from, to))
      .filter((p) => !statusFilter || p.status === statusFilter)
      .filter((p) => !driverFilter || p.driverId === driverFilter)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    const rec = receipts
      .filter((r) => inRange(r.date, from, to))
      .filter((r) => !statusFilter || r.status === statusFilter)
      .sort((a, b) => b.date.localeCompare(a.date));
    const lp = loanPayments
      .filter((p) => inRange(p.date, from, to))
      .filter((p) => !statusFilter || p.status === statusFilter)
      .sort((a, b) => b.date.localeCompare(a.date));
    const xfer = bankTransfers
      .filter((t) => inRange(t.date, from, to))
      .sort((a, b) => b.date.localeCompare(a.date));
    return { exp, pay, rec, lp, xfer };
  }, [expenses, payouts, receipts, loanPayments, bankTransfers, from, to, statusFilter, driverFilter]);

  const summary = useMemo(() => {
    const expTotal = filtered.exp.reduce((s, e) => s + e.amount, 0);
    const income = filtered.rec.reduce((s, r) => s + r.amount, 0);
    const advances = filtered.pay.filter((p) => p.kind === "advance").reduce((s, p) => s + p.amount, 0);
    const salary = filtered.pay.filter((p) => p.kind === "salary").reduce((s, p) => s + p.amount, 0);
    const extra = filtered.pay.filter((p) => p.kind === "extra_route").reduce((s, p) => s + p.amount, 0);
    const bonus = filtered.pay.filter((p) => p.kind === "bonus").reduce((s, p) => s + p.amount, 0);
    const fines = filtered.pay.filter((p) => p.kind === "fine").reduce((s, p) => s + p.amount, 0);
    const returns = filtered.pay.filter((p) => p.kind === "return").reduce((s, p) => s + p.amount, 0);
    const emi = filtered.lp.reduce((s, p) => s + p.amount, 0);
    const xferOut = filtered.xfer.reduce((s, t) => s + t.amount, 0);

    const catMap = new Map<string, number>();
    for (const e of filtered.exp) {
      const c = e.category || "Other";
      catMap.set(c, (catMap.get(c) || 0) + e.amount);
    }
    const byCategory = [...catMap.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    const activeDrivers = drivers.filter((d) => d.active);
    const driverRows = activeDrivers
      .map((d) => {
        const rangePay = filtered.pay.filter((p) => p.driverId === d.id);
        return {
          driver: d,
          balance: driverBalance(d, payouts, to),
          advances: rangePay.filter((p) => p.kind === "advance").reduce((s, p) => s + p.amount, 0),
          salary: rangePay.filter((p) => p.kind === "salary").reduce((s, p) => s + p.amount, 0),
          extra: rangePay.filter((p) => p.kind === "extra_route").reduce((s, p) => s + p.amount, 0),
          fines: rangePay.filter((p) => p.kind === "fine").reduce((s, p) => s + p.amount, 0),
          returns: rangePay.filter((p) => p.kind === "return").reduce((s, p) => s + p.amount, 0),
          txCount: rangePay.length,
        };
      })
      .filter((r) => !driverFilter || r.driver.id === driverFilter)
      .sort((a, b) => a.balance - b.balance);

    return {
      expTotal,
      income,
      advances,
      salary,
      extra,
      bonus,
      fines,
      returns,
      emi,
      xferOut,
      byCategory,
      driverRows,
      netCashish: income - expTotal - advances - emi + returns,
    };
  }, [filtered, drivers, payouts, to, driverFilter]);

  function exportCsv() {
    const stamp = `${from}_to_${to}`;
    if (kind === "expenses") {
      downloadCsv(`expenses_${stamp}.csv`, [
        ["Date", "Category", "Vendor", "Amount", "Mode", "Status", "Bank", "Note"],
        ...filtered.exp.map((e) => [
          e.date, e.category, e.vendor || "", e.amount, e.mode, e.status, bankName(e.bankAccountId), e.note || "",
        ]),
      ]);
      return;
    }
    if (kind === "payouts") {
      downloadCsv(`payouts_${stamp}.csv`, [
        ["Date", "Driver", "Kind", "Amount", "Mode", "Status", "Bank", "Note"],
        ...filtered.pay.map((p) => [
          p.date, driverName(p.driverId), KIND_LABEL[p.kind] || p.kind, p.amount, p.mode, p.status, bankName(p.bankAccountId), p.note || "",
        ]),
      ]);
      return;
    }
    if (kind === "drivers") {
      downloadCsv(`drivers_${stamp}.csv`, [
        ["Driver", "Balance", "Advances", "Salary slips", "Extra work", "Fines", "Returns", "Tx count"],
        ...summary.driverRows.map((r) => [
          r.driver.name, r.balance, r.advances, r.salary, r.extra, r.fines, r.returns, r.txCount,
        ]),
      ]);
      return;
    }
    if (kind === "receipts") {
      downloadCsv(`receipts_${stamp}.csv`, [
        ["Date", "Customer", "Amount", "Mode", "Status", "Bank", "Note"],
        ...filtered.rec.map((r) => [
          r.date, r.customerName || "", r.amount, r.mode, r.status, bankName(r.bankAccountId), r.note || "",
        ]),
      ]);
      return;
    }
    if (kind === "loans") {
      downloadCsv(`loan_payments_${stamp}.csv`, [
        ["Date", "Loan", "Kind", "Amount", "Mode", "Status", "Bank", "Note"],
        ...filtered.lp.map((p) => [
          p.date, loanName(p.loanId), KIND_LABEL[p.kind] || p.kind, p.amount, p.mode, p.status, bankName(p.bankAccountId), p.note || "",
        ]),
      ]);
      return;
    }
    if (kind === "bank") {
      downloadCsv(`transfers_${stamp}.csv`, [
        ["Date", "From", "To", "Amount", "Note"],
        ...filtered.xfer.map((t) => [t.date, bankName(t.fromBankId), bankName(t.toBankId), t.amount, t.note || ""]),
      ]);
      return;
    }
    downloadCsv(`summary_${stamp}.csv`, [
      ["Metric", "Amount"],
      ["Income (receipts)", summary.income],
      ["Expenses", summary.expTotal],
      ["Advances", summary.advances],
      ["Salary slips", summary.salary],
      ["Extra work", summary.extra],
      ["Bonus", summary.bonus],
      ["Fines", summary.fines],
      ["Returns", summary.returns],
      ["Loan EMI", summary.emi],
      ["Transfers volume", summary.xferOut],
      ["Approx net (income - spend - advances - EMI + returns)", summary.netCashish],
      [],
      ["Expense category", "Amount"],
      ...summary.byCategory.map((c) => [c.label, c.value]),
      [],
      ["Driver", "Balance", "Advances", "Salary", "Extra", "Fines", "Returns"],
      ...summary.driverRows.map((r) => [r.driver.name, r.balance, r.advances, r.salary, r.extra, r.fines, r.returns]),
    ]);
  }

  function printReport() {
    window.print();
  }

  const rangeLabel = `${shortDate(from)} → ${shortDate(to)}`;

  return (
    <div className="space-y-4 print:space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-xl font-medium tracking-tight text-ink sm:text-2xl">Reports</h1>
          <p className="mt-0.5 text-sm text-muted">Date-range reports for expenses, drivers, payouts & more</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
            <Download className="size-4" />
            CSV
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={printReport}>
            <Printer className="size-4" />
            Print
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden p-0 print:hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
          <Filter className="size-4 text-muted" />
          <CardTitle className="text-sm">Filters</CardTitle>
          <CardHint className="ml-auto mt-0">{rangeLabel}</CardHint>
        </div>
        <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="text-muted">From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="h-9 w-full rounded-md border border-line bg-raised px-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent/25" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="h-9 w-full rounded-md border border-line bg-raised px-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent/25" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 w-full rounded-md border border-line bg-raised px-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent/25">
              <option value="">All</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Driver</span>
            <select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)}
              className="h-9 w-full rounded-md border border-line bg-raised px-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent/25">
              <option value="">All drivers</option>
              {drivers.filter((d) => d.active).sort((a, b) => a.name.localeCompare(b.name)).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5 border-t border-line p-3">
          {REPORTS.map((r) => {
            const Icon = r.icon;
            const active = kind === r.id;
            return (
              <button key={r.id} type="button" onClick={() => setKind(r.id)} title={r.hint}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                  active ? "border-navy bg-navy text-navy-fg" : "border-line bg-raised text-ink hover:bg-accent-soft",
                )}>
                <Icon className="size-3.5" />
                {r.label}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="hidden print:block">
        <h1 className="text-lg font-semibold">Satelkar’s Logistics — {REPORTS.find((r) => r.id === kind)?.label}</h1>
        <p className="text-sm text-gray-600">
          {rangeLabel}{statusFilter ? ` · ${statusFilter}` : ""}{driverFilter ? ` · ${driverName(driverFilter)}` : ""}
        </p>
      </div>

      {kind === "summary" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi label="Income" value={summary.income} tone="ok" />
            <Kpi label="Expenses" value={summary.expTotal} tone="warn" />
            <Kpi label="Advances" value={summary.advances} />
            <Kpi label="Loan EMI" value={summary.emi} />
            <Kpi label="Salary slips" value={summary.salary} />
            <Kpi label="Extra work" value={summary.extra} />
            <Kpi label="Returns" value={summary.returns} tone="ok" />
            <Kpi label="Approx net" value={summary.netCashish} tone={summary.netCashish >= 0 ? "ok" : "warn"} />
          </div>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-line px-3 py-2">
              <CardTitle className="text-sm">Expenses by category</CardTitle>
            </div>
            <div className="divide-y divide-line">
              {summary.byCategory.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted">No expenses in range</p>
              ) : (
                summary.byCategory.map((c) => (
                  <div key={c.label} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="text-ink">{c.label}</span>
                    <span className="tabular-nums font-medium">{inr(c.value)}</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-line px-3 py-2">
              <CardTitle className="text-sm">Driver snapshot</CardTitle>
              <CardHint>Balance through {shortDate(to)}; range columns use selected dates</CardHint>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-line bg-raised text-[12px] text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Driver</th>
                    <th className="px-3 py-2 font-medium text-right">Balance</th>
                    <th className="px-3 py-2 font-medium text-right">Advances</th>
                    <th className="px-3 py-2 font-medium text-right">Salary</th>
                    <th className="px-3 py-2 font-medium text-right">Extra</th>
                    <th className="px-3 py-2 font-medium text-right">Fines</th>
                    <th className="px-3 py-2 font-medium text-right">Returns</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {summary.driverRows.map((r) => (
                    <tr key={r.driver.id}>
                      <td className="px-3 py-2 font-medium text-ink">{r.driver.name}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", r.balance < 0 && "text-amber-700")}>{inr(r.balance)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{inr(r.advances)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{inr(r.salary)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{inr(r.extra)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{inr(r.fines)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{inr(r.returns)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}

      {kind === "expenses" ? (
        <ReportTable title={`Expenses (${filtered.exp.length})`} total={filtered.exp.reduce((s, e) => s + e.amount, 0)} empty="No expenses in this range"
          headers={["Date", "Category", "Vendor", "Amount", "Mode", "Bank", "Note"]}
          rows={filtered.exp.map((e) => [shortDate(e.date), e.category || "—", e.vendor || "—", inr(e.amount), e.mode, bankName(e.bankAccountId), e.note || ""])} />
      ) : null}

      {kind === "payouts" ? (
        <ReportTable title={`Payouts (${filtered.pay.length})`} total={filtered.pay.reduce((s, p) => s + p.amount, 0)} empty="No payouts in this range"
          headers={["Date", "Driver", "Kind", "Amount", "Status", "Mode", "Bank", "Note"]}
          rows={filtered.pay.map((p) => [shortDate(p.date), driverName(p.driverId), KIND_LABEL[p.kind] || p.kind, inr(p.amount), p.status, p.mode, bankName(p.bankAccountId), p.note || ""])} />
      ) : null}

      {kind === "drivers" ? (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
            <CardTitle className="text-sm">Drivers in range</CardTitle>
            <Badge tone="muted">{summary.driverRows.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line bg-raised text-[12px] text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Driver</th>
                  <th className="px-3 py-2 font-medium text-right">Balance</th>
                  <th className="px-3 py-2 font-medium text-right">Advances</th>
                  <th className="px-3 py-2 font-medium text-right">Salary slips</th>
                  <th className="px-3 py-2 font-medium text-right">Extra work</th>
                  <th className="px-3 py-2 font-medium text-right">Fines</th>
                  <th className="px-3 py-2 font-medium text-right">Returns</th>
                  <th className="px-3 py-2 font-medium text-right">Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {summary.driverRows.map((r) => (
                  <tr key={r.driver.id}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-ink">{r.driver.name}</div>
                      {r.driver.mobile ? <div className="text-[12px] text-muted">{r.driver.mobile}</div> : null}
                    </td>
                    <td className={cn("px-3 py-2 text-right tabular-nums font-medium", r.balance < 0 && "text-amber-700")}>{inr(r.balance)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{inr(r.advances)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{inr(r.salary)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{inr(r.extra)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{inr(r.fines)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{inr(r.returns)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{r.txCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {kind === "receipts" ? (
        <ReportTable title={`Receipts (${filtered.rec.length})`} total={filtered.rec.reduce((s, r) => s + r.amount, 0)} empty="No receipts in this range"
          headers={["Date", "Customer", "Amount", "Mode", "Status", "Bank", "Note"]}
          rows={filtered.rec.map((r) => [shortDate(r.date), r.customerName || "—", inr(r.amount), r.mode, r.status, bankName(r.bankAccountId), r.note || ""])} />
      ) : null}

      {kind === "loans" ? (
        <ReportTable title={`Loan payments (${filtered.lp.length})`} total={filtered.lp.reduce((s, p) => s + p.amount, 0)} empty="No loan payments in this range"
          headers={["Date", "Loan", "Kind", "Amount", "Status", "Mode", "Bank", "Note"]}
          rows={filtered.lp.map((p) => [shortDate(p.date), loanName(p.loanId), KIND_LABEL[p.kind] || p.kind, inr(p.amount), p.status, p.mode, bankName(p.bankAccountId), p.note || ""])} />
      ) : null}

      {kind === "bank" ? (
        <ReportTable title={`Transfers (${filtered.xfer.length})`} total={filtered.xfer.reduce((s, t) => s + t.amount, 0)} empty="No transfers in this range"
          headers={["Date", "From", "To", "Amount", "Note"]}
          rows={filtered.xfer.map((t) => [shortDate(t.date), bankName(t.fromBankId), bankName(t.toBankId), inr(t.amount), t.note || ""])} />
      ) : null}

      <p className="print:hidden text-center text-[12px] text-subtle">
        <FileSpreadsheet className="mr-1 inline size-3.5" />
        Export CSV or print any report. Charts stay on Home / Analysis.
      </p>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={cn("mt-1 text-lg font-semibold tabular-nums tracking-tight", tone === "ok" && "text-emerald-700", tone === "warn" && "text-amber-700", !tone && "text-ink")}>
        {inr(value)}
      </div>
    </Card>
  );
}

function ReportTable({ title, total, empty, headers, rows }: { title: string; total: number; empty: string; headers: string[]; rows: string[][] }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <span className="text-sm font-semibold tabular-nums text-ink">{inr(total)}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-muted">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line bg-raised text-[12px] text-muted">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className={cn("px-3 py-2 max-w-[14rem] truncate", j === 0 ? "whitespace-nowrap text-muted" : "text-ink", headers[j]?.toLowerCase() === "amount" && "text-right tabular-nums font-medium")}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
