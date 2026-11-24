/**
 * Driver Party Statement — Vyapar-style ledger with running balance.
 * Printable HTML (Save as PDF from browser print dialog).
 */

import { inr, shortDate } from "./format";
import type { BankAccount, Driver, Payout } from "./types";

const COMPANY = "Satelkar's Logistic";
const COMPANY_ADDRESS = "Goel Ganga Altus, Shop no 2, Kharadi";
const COMPANY_PHONE = "9886527036";
const COMPANY_EMAIL = "satelkarlogistic@gmail.com";

export type PartyTxnType = "Purchase" | "Payment-out" | "Payment-in" | "Sale";

export type PartyStatementRow = {
  id: string;
  date: string;
  txnType: PartyTxnType;
  /** Vyapar-style item lines under the txn (optional). */
  items: { name: string; qty?: number; unit?: string; price?: number; amount: number }[];
  totalAmount: number;
  /** Cash/bank amount paid/received on this txn (0 for pure accrual). */
  paidAmount: number;
  description: string;
  paymentType: string;
  /** Balance after this row. Positive = company owes driver; negative = driver owes company. */
  balanceAfter: number;
};

export type PartyStatementData = {
  company: string;
  address: string;
  phone: string;
  email: string;
  driverName: string;
  mobile: string;
  from: string;
  to: string;
  openingBalance: number;
  rows: PartyStatementRow[];
  /** Final balance (same sign convention as app). */
  closingBalance: number;
  /** Absolute amount shown as "Total Receivable" when driver owes, or "Total Payable" when company owes. */
  closingLabel: "Receivable" | "Payable";
  closingAbs: number;
};

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function inrDec(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

/** Same balance rules as format.driverBalance / drivers page. */
function balanceDelta(kind: string, amount: number, status: string): number {
  const a = Number(amount) || 0;
  if (kind === "extra_route" && status === "pending") return +a;
  if (kind === "extra_route") return 0; // paid extra work: cash already out, no balance change
  if (status !== "paid") return 0;
  if (kind === "advance" || kind === "fine") return -a;
  if (kind === "return" || kind === "salary" || kind === "bonus") return +a;
  return 0;
}

function mapTxn(kind: string, status: string): {
  txnType: PartyTxnType;
  itemName: string;
  paid: boolean;
} {
  switch (kind) {
    case "salary":
      return { txnType: "Purchase", itemName: "Driver Service (Salary)", paid: false };
    case "bonus":
      return { txnType: "Purchase", itemName: "Bonus", paid: false };
    case "extra_route":
      return {
        txnType: status === "pending" ? "Purchase" : "Purchase",
        itemName: status === "pending" ? "Extra work (unpaid)" : "Extra work",
        paid: status === "paid",
      };
    case "advance":
      return { txnType: "Payment-out", itemName: "Advance", paid: true };
    case "return":
      return { txnType: "Payment-in", itemName: "Return from driver", paid: true };
    case "fine":
      return { txnType: "Sale", itemName: "Fine / deduction", paid: false };
    default:
      return { txnType: "Payment-out", itemName: kind, paid: status === "paid" };
  }
}

function modeLabel(mode: string, bankName: string) {
  if (mode === "cash") return "Cash";
  if (mode === "upi") return bankName ? `UPI · ${bankName}` : "UPI";
  if (mode === "bank") return bankName || "Bank";
  return bankName || mode || "—";
}

/**
 * Build party statement for one driver over [from, to].
 * Opening = balance through day before `from`.
 */
export function buildPartyStatement(input: {
  driver: Driver;
  payouts: Payout[];
  banks: BankAccount[];
  from: string;
  to: string;
}): PartyStatementData {
  const { driver, payouts, banks, from, to } = input;
  const bankName = (id: string) => banks.find((b) => b.id === id)?.name || "";

  const allForDriver = payouts
    .filter((p) => p.driverId === driver.id)
    .slice()
    .sort((a, b) => {
      const d = String(a.date).localeCompare(String(b.date));
      if (d !== 0) return d;
      return String(a.createdAt || a.id).localeCompare(String(b.createdAt || b.id));
    });

  // Opening: apply all txns strictly before `from`
  let bal = Number(driver.openingBalance) || 0;
  for (const p of allForDriver) {
    const d = String(p.date || "").slice(0, 10);
    if (d >= from) continue;
    bal = Math.round((bal + balanceDelta(p.kind, p.amount, p.status)) * 100) / 100;
  }
  const openingBalance = bal;

  const inRange = allForDriver.filter((p) => {
    const d = String(p.date || "").slice(0, 10);
    return d >= from && d <= to;
  });

  const rows: PartyStatementRow[] = [];
  for (const p of inRange) {
    const mapped = mapTxn(p.kind, p.status);
    const delta = balanceDelta(p.kind, p.amount, p.status);
    // Skip rows that neither move balance nor were a cash payment
    if (delta === 0 && !(mapped.paid && (p.kind === "advance" || p.kind === "return" || p.kind === "extra_route"))) {
      if (p.status !== "paid" && p.kind !== "extra_route") continue;
    }
    bal = Math.round((bal + delta) * 100) / 100;

    const paidAmount =
      mapped.txnType === "Payment-out" || mapped.txnType === "Payment-in"
        ? p.amount
        : mapped.paid
          ? p.amount
          : 0;

    const items =
      mapped.txnType === "Purchase" || mapped.txnType === "Sale"
        ? [{ name: mapped.itemName, qty: 1, unit: "NOS", price: p.amount, amount: p.amount }]
        : [];

    rows.push({
      id: p.id,
      date: p.date,
      txnType: mapped.txnType,
      items,
      totalAmount: p.amount,
      paidAmount,
      description: p.note || mapped.itemName,
      paymentType: modeLabel(p.mode, bankName(p.bankAccountId)),
      balanceAfter: bal,
    });
  }

  const closingBalance = bal;
  const closingLabel: "Receivable" | "Payable" = closingBalance < 0 ? "Receivable" : "Payable";
  const closingAbs = Math.abs(closingBalance);

  return {
    company: COMPANY,
    address: COMPANY_ADDRESS,
    phone: COMPANY_PHONE,
    email: COMPANY_EMAIL,
    driverName: driver.name,
    mobile: driver.mobile || "",
    from,
    to,
    openingBalance,
    rows,
    closingBalance,
    closingLabel,
    closingAbs,
  };
}

export function partyStatementHtml(d: PartyStatementData): string {
  const rowHtml = d.rows
    .map((r) => {
      const bal = r.balanceAfter;
      const payableCell = bal >= 0 ? inrDec(bal) : "";
      const receivableCell = bal < 0 ? inrDec(Math.abs(bal)) : "";
      const itemsBlock =
        r.items.length > 0
          ? `<tr class="items"><td colspan="8" style="padding:0 8px 8px 8px">
              <table class="inner">
                <thead><tr><th>#</th><th>Item Name</th><th>Qty</th><th>Unit</th><th>Price/Unit</th><th>Amount</th></tr></thead>
                <tbody>
                  ${r.items
                    .map(
                      (it, i) =>
                        `<tr><td>${i + 1}</td><td>${escapeHtml(it.name)}</td><td>${it.qty ?? ""}</td><td>${escapeHtml(it.unit || "")}</td><td>${it.price != null ? inrDec(it.price) : ""}</td><td>${inrDec(it.amount)}</td></tr>`,
                    )
                    .join("")}
                  <tr class="sub"><td colspan="5" style="text-align:right">Sub Total:</td><td>${inrDec(r.totalAmount)}</td></tr>
                </tbody>
              </table>
            </td></tr>`
          : "";

      return (
        `<tr class="txn">
          <td>${escapeHtml(fmtDate(r.date))}</td>
          <td><strong>${escapeHtml(r.txnType)}</strong></td>
          <td></td>
          <td class="num">${inrDec(r.totalAmount)}</td>
          <td class="num">${r.paidAmount ? inrDec(r.paidAmount) : inrDec(0)}</td>
          <td class="num">${r.paidAmount === 0 && (r.txnType === "Purchase" || r.txnType === "Sale") ? inrDec(r.totalAmount) : ""}</td>
          <td class="num">${receivableCell}</td>
          <td class="num">${payableCell}</td>
        </tr>
        ${itemsBlock}
        <tr class="meta"><td colspan="8">
          <div class="desc"><span>Description:</span> ${escapeHtml(r.description || "—")}</div>
          ${r.paymentType ? `<div class="pay"><span>Payment Type:</span> ${escapeHtml(r.paymentType)}</div>` : ""}
        </td></tr>`
      );
    })
    .join("\n");

  const openBal = d.openingBalance;
  const openPay = openBal >= 0 ? inrDec(openBal) : "";
  const openRec = openBal < 0 ? inrDec(Math.abs(openBal)) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Party Statement — ${escapeHtml(d.driverName)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 16px; color: #111; font-size: 12px; background: #fff; }
  .sheet { max-width: 900px; margin: 0 auto; }
  .hdr { text-align: center; margin-bottom: 12px; }
  .hdr h1 { margin: 0; font-size: 20px; font-weight: 700; }
  .hdr .addr { margin: 4px 0 0; font-size: 11px; color: #333; }
  h2 { text-align: center; margin: 14px 0 10px; font-size: 16px; text-decoration: underline; font-weight: 700; }
  .party { margin-bottom: 12px; line-height: 1.5; }
  .party strong { font-weight: 700; }
  table.main { width: 100%; border-collapse: collapse; font-size: 11px; }
  table.main th { background: #f0f0f0; border: 1px solid #333; padding: 6px 4px; text-align: center; font-weight: 700; }
  table.main td { border: 1px solid #bbb; padding: 5px 4px; vertical-align: top; }
  table.main td.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  tr.meta td { border-top: none; border-bottom: 1px solid #333; padding: 2px 8px 8px; font-size: 11px; color: #333; }
  tr.meta .desc span, tr.meta .pay span { font-weight: 700; }
  tr.items td { border-top: none; border-bottom: none; }
  table.inner { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 11px; }
  table.inner th { background: #e8e8e8; border: 1px solid #999; padding: 3px 4px; text-align: left; }
  table.inner td { border: 1px solid #ccc; padding: 3px 4px; }
  table.inner tr.sub td { font-weight: 700; }
  .opening td { background: #fafafa; font-weight: 600; }
  .footer { margin-top: 16px; font-size: 13px; font-weight: 700; text-align: right; }
  .note { margin-top: 8px; font-size: 10px; color: #666; }
  @media print {
    body { padding: 0; }
    .noprint { display: none !important; }
  }
</style>
</head>
<body>
<div class="sheet">
  <div class="hdr">
    <h1>${escapeHtml(d.company)}</h1>
    <div class="addr">Address: ${escapeHtml(d.address)} · Ph. no.: ${escapeHtml(d.phone)} · Email: ${escapeHtml(d.email)}</div>
  </div>
  <h2>Party Statement</h2>
  <div class="party">
    <div><strong>Party name:</strong> Driver ${escapeHtml(d.driverName)}</div>
    <div><strong>Contact no.:</strong> ${d.mobile ? escapeHtml(d.mobile) : "—"}</div>
    <div><strong>Duration:</strong> From ${escapeHtml(fmtDate(d.from))} to ${escapeHtml(fmtDate(d.to))}</div>
  </div>

  <table class="main">
    <thead>
      <tr>
        <th style="width:9%">Date</th>
        <th style="width:12%">Txn Type</th>
        <th style="width:10%">Invoice/<br/>Bill No.</th>
        <th style="width:12%">Total Amount</th>
        <th style="width:12%">Received/<br/>Paid Amount</th>
        <th style="width:11%">Txn Balance</th>
        <th style="width:12%">Receivable<br/>Balance</th>
        <th style="width:12%">Payable<br/>Balance</th>
      </tr>
    </thead>
    <tbody>
      <tr class="opening">
        <td>${escapeHtml(fmtDate(d.from))}</td>
        <td colspan="5"><em>Opening balance</em></td>
        <td class="num">${openRec}</td>
        <td class="num">${openPay}</td>
      </tr>
      ${rowHtml || `<tr><td colspan="8" style="text-align:center;padding:16px;color:#666">No transactions in this period</td></tr>`}
    </tbody>
  </table>

  <div class="footer">
    Total ${d.closingLabel} balance: ${inrDec(d.closingAbs)}
  </div>
  <p class="note">
    Payable = company owes driver · Receivable = driver owes company.<br/>
    Generated ${escapeHtml(fmtDate(new Date().toISOString().slice(0, 10)))} · ${escapeHtml(d.company)}
  </p>
  <p class="noprint" style="text-align:center;margin-top:20px">
    <button onclick="window.print()" style="padding:10px 18px;font-size:14px;cursor:pointer">Print / Save as PDF</button>
  </p>
</div>
<script>window.onload=function(){setTimeout(function(){try{window.print()}catch(e){}},400)}<\/script>
</body>
</html>`;
}

export function printPartyStatement(d: PartyStatementData) {
  const html = partyStatementHtml(d);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `party-statement-${(d.driverName || "driver").replace(/\s+/g, "-")}.html`;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
