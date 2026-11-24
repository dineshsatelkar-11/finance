import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Download,
  Printer,
  Filter,
  Truck,
  Receipt,
  Wallet,
  Landmark,
  HandCoins,
  Banknote,
  LayoutList,
  ListOrdered,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/lib/finance/store";
import { inr, shortDate, todayISO } from "@/lib/finance/format";
import { buildPartyStatement, printPartyStatement } from "@/lib/finance/party-statement";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

type ReportKind =
  | "statement"
  | "summary"
  | "expenses"
  | "drivers"
  | "payouts"
  | "receipts"
  | "loans"
  | "bank";

const REPORTS: { id: ReportKind; label: string; icon: typeof Receipt; hint: string }[] = [
  { id: "statement", label: "All transactions", icon: ListOrdered, hint: "Full statement with running balance after each row" },
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

type StmtRow = {
  id: string;
  date: string;
  type: string;
  party: string;
  detail: string;
  amount: number;
  dir: "in" | "out" | "none";
  status: string;
  bank: string;
  cash: boolean;
  createdAt?: string;
  balAfter?: number | null;
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

  const [kind, setKind] = useState<ReportKind>("statement");
  const [from, setFrom] = useState(monthStartISO);
  const [to, setTo] = useState(todayISO());
  const [driverFilter, setDriverFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [bankFilter, setBankFilter] = useState<string>("");

  const bankName = (id: string) => banks.find((b) => b.id === id)?.name || id || "—";
  const driverName = (id: string) => drivers.find((d) => d.id === id)?.name || id || "—";
  const loanName = (id: string) => loans.find((l) => l.id === id)?.name || id || "—";

  const filtered = useMemo(() => {
    const exp = expenses
      .filter((e) => inRange(e.date, from, to))
      .filter((e) => !statusFilter || e.status === statusFilter)
      .sort((a, b) => b.date.localeCompare(a.date));
    const pay = payouts
      .filter((p) => inRange(p.date, from, to))
      .filter((p) => !statusFilter || p.status === statusFilter)
      .filter((p) => !driverFilter || p.driverId === driverFilter)
      .sort((a, b) => b.date.localeCompare(a.date));
    const rec = receipts
      .filter((r) => inRange(r.date, from, to))
      .filter((r) => !statusFilter || r.status === statusFilter)
      .sort((a, b) => b.date.localeCompare(a.date));
    const lp = loanPayments
      .filter((p) => inRange(p.date, from, to))
      .filter((p) => !statusFilter || p.status === statusFilter)
      .sort((a, b) => b.date.localeCompare(a.date));
    const xfer = bankTransfers.filter((t) => inRange(t.date, from, to)).sort((a, b) => b.date.localeCompare(a.date));
    return { exp, pay, rec, lp, xfer };
  }, [expenses, payouts, receipts, loanPayments, bankTransfers, from, to, statusFilter, driverFilter]);

  const pending = useMemo(() => {
    const payPend = payouts.filter((p) => p.status === "pending" && (!driverFilter || p.driverId === driverFilter));
    const expPend = expenses.filter((e) => e.status === "pending");
    const recPend = receipts.filter((r) => r.status === "pending");
    const lpPend = loanPayments.filter((p) => p.status === "pending");
    return {
      payoutAmt: payPend.reduce((s, p) => s + p.amount, 0),
      payoutCount: payPend.length,
      expenseAmt: expPend.reduce((s, e) => s + e.amount, 0),
      expenseCount: expPend.length,
      receiptAmt: recPend.reduce((s, r) => s + r.amount, 0),
      receiptCount: recPend.length,
      loanAmt: lpPend.reduce((s, p) => s + p.amount, 0),
      loanCount: lpPend.length,
    };
  }, [payouts, expenses, receipts, loanPayments, driverFilter]);

  function printDriverPartyPdf() {
    if (!driverFilter) {
      toast.error("Select a driver first to print party statement");
      return;
    }
    const driver = drivers.find((d) => d.id === driverFilter);
    if (!driver) {
      toast.error("Driver not found");
      return;
    }
    const data = buildPartyStatement({ driver, payouts, banks, from, to });
    printPartyStatement(data);
  }

  const rangeLabel = `${shortDate(from)} → ${shortDate(to)}`;

  return (
    <div className="space-y-4 print:space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-xl font-medium tracking-tight text-ink sm:text-2xl">Reports</h1>
          <p className="mt-0.5 text-sm text-muted">
            Party statement PDF (Vyapar style) · date-range lists · pending totals
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={driverFilter ? "default" : "outline"}
            size="sm"
            onClick={printDriverPartyPdf}
            title={driverFilter ? "Print party statement PDF" : "Select a driver first"}
          >
            <FileSpreadsheet className="size-4" />
            Party PDF
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
              className="h-9 w-full rounded-md border border-line bg-raised px-2 text-sm text-ink outline-none" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="h-9 w-full rounded-md border border-line bg-raised px-2 text-sm text-ink outline-none" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Driver (required for Party PDF)</span>
            <select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)}
              className="h-9 w-full rounded-md border border-line bg-raised px-2 text-sm text-ink outline-none">
              <option value="">Select driver…</option>
              {drivers.filter((d) => d.active).sort((a, b) => a.name.localeCompare(b.name)).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 w-full rounded-md border border-line bg-raised px-2 text-sm text-ink outline-none">
              <option value="">All</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </label>
        </div>
      </Card>

      {driverFilter ? (
        <Card className="border-accent/40 bg-accent-soft/30 p-4 print:hidden">
          <p className="text-sm text-ink">
            Ready: <strong>Driver {driverName(driverFilter)}</strong> · {rangeLabel}
          </p>
          <p className="mt-1 text-[13px] text-muted">
            Tap <strong>Party PDF</strong> for a Vyapar-style statement with running balance after every transaction
            (payable / receivable). Use browser Print → Save as PDF.
          </p>
          <Button type="button" className="mt-3" onClick={printDriverPartyPdf}>
            <FileSpreadsheet className="size-4" />
            Open party statement
          </Button>
        </Card>
      ) : (
        <Card className="p-4 print:hidden">
          <p className="text-sm text-muted">
            Select a <strong>driver</strong>, set the date range, then open <strong>Party PDF</strong>.
            Layout matches your Vyapar party statement (Purchase / Payment-out / running balance).
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="Pending payouts" value={pending.payoutAmt} sub={`${pending.payoutCount} items`} tone="warn" />
        <Kpi label="Pending expenses" value={pending.expenseAmt} sub={`${pending.expenseCount} items`} tone="warn" />
        <Kpi label="Pending receipts" value={pending.receiptAmt} sub={`${pending.receiptCount} items`} />
        <Kpi label="Pending loans" value={pending.loanAmt} sub={`${pending.loanCount} items`} />
      </div>

      <div className="flex flex-wrap gap-1.5 print:hidden">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          const active = kind === r.id;
          return (
            <button key={r.id} type="button" onClick={() => setKind(r.id)} title={r.hint}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium",
                active ? "border-navy bg-navy text-navy-fg" : "border-line bg-raised text-ink",
              )}>
              <Icon className="size-3.5" />
              {r.label}
            </button>
          );
        })}
      </div>

      {kind === "expenses" ? (
        <SimpleTable title={`Expenses (${filtered.exp.length})`}
          headers={["Date", "Category", "Vendor", "Amount", "Status"]}
          rows={filtered.exp.map((e) => [shortDate(e.date), e.category, e.vendor || "—", inr(e.amount), e.status])} />
      ) : null}
      {kind === "payouts" ? (
        <SimpleTable title={`Payouts (${filtered.pay.length})`}
          headers={["Date", "Driver", "Kind", "Amount", "Status"]}
          rows={filtered.pay.map((p) => [shortDate(p.date), driverName(p.driverId), KIND_LABEL[p.kind] || p.kind, inr(p.amount), p.status])} />
      ) : null}
      {kind === "drivers" ? (
        <SimpleTable title="Drivers"
          headers={["Driver", "Balance"]}
          rows={drivers.filter((d) => d.active && (!driverFilter || d.id === driverFilter)).map((d) => [d.name, inr(driverBalance(d, payouts, to))])} />
      ) : null}
      {kind === "receipts" ? (
        <SimpleTable title={`Receipts (${filtered.rec.length})`}
          headers={["Date", "Customer", "Amount", "Status"]}
          rows={filtered.rec.map((r) => [shortDate(r.date), r.customerName || "—", inr(r.amount), r.status])} />
      ) : null}
      {kind === "loans" ? (
        <SimpleTable title={`Loan payments (${filtered.lp.length})`}
          headers={["Date", "Loan", "Amount", "Status"]}
          rows={filtered.lp.map((p) => [shortDate(p.date), loanName(p.loanId), inr(p.amount), p.status])} />
      ) : null}
      {kind === "bank" ? (
        <SimpleTable title={`Transfers (${filtered.xfer.length})`}
          headers={["Date", "From", "To", "Amount"]}
          rows={filtered.xfer.map((t) => [shortDate(t.date), bankName(t.fromBankId), bankName(t.toBankId), inr(t.amount)])} />
      ) : null}
      {kind === "summary" || kind === "statement" ? (
        <Card className="p-4">
          <CardTitle className="text-sm">How to get the PDF like Vyapar</CardTitle>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>Choose <strong>Driver</strong> and date range</li>
            <li>Tap <strong>Party PDF</strong></li>
            <li>In the new tab: Print → Save as PDF</li>
          </ol>
          <p className="mt-3 text-[13px] text-muted">
            Statement includes salary (Purchase), advances (Payment-out), extra work, fines, returns,
            with running payable/receivable balance after each row.
          </p>
        </Card>
      ) : null}
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: number; sub?: string; tone?: "ok" | "warn" }) {
  return (
    <Card className="p-3">
      <p className="text-[12px] text-muted">{label}</p>
      <p className={cn("mt-1 font-display text-lg font-medium tabular-nums", tone === "ok" && "text-emerald-700", tone === "warn" && "text-amber-800")}>
        {inr(value)}
      </p>
      {sub ? <p className="mt-0.5 text-[11px] text-muted">{sub}</p> : null}
    </Card>
  );
}

function SimpleTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-line px-3 py-2"><CardTitle className="text-sm">{title}</CardTitle></div>
      {rows.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-muted">No rows</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-line bg-raised text-[12px] text-muted">
              <tr>{headers.map((h) => <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row, i) => (
                <tr key={i}>{row.map((cell, j) => <td key={j} className="px-3 py-2 max-w-[12rem] truncate">{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
