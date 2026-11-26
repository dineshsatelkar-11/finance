/**
 * Driver Party Statement — Vyapar-style ledger with running balance.
 * Balance rules match format.driverBalance / Drivers tab exactly.
 * Printable HTML (Save as PDF from browser print dialog).
 */

import type { BankAccount, Driver, Payout } from "./types";

const COMPANY = "Satelkar's Logistic";
const COMPANY_ADDRESS = "Goel Ganga Altus, Shop no 2, Kharadi";
const COMPANY_PHONE = "9886527036";
const COMPANY_EMAIL = "satelkarlogistic@gmail.com";

export type PartyTxnType = "Purchase" | "Payment-out" | "Payment-in" | "Sale" | "Info";

export type PartyStatementRow = {
  id: string;
  date: string;
  txnType: PartyTxnType;
  items: { name: string; qty?: number; unit?: string; price?: number; amount: number }[];
  totalAmount: number;
  paidAmount: number;
  description: string;
  paymentType: string;
  /** Same sign as app: + company owes driver, − driver owes company. */
  balanceAfter: number;
  /** How this row moved balance (for clarity on the PDF). */
  effect: string;
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
  closingBalance: number;
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

/**
 * Exact same rules as format.driverBalance:
 * opening − advances − fines + returns + salary + unpaid extra work.
 * Bonus and paid extra work do not change balance.
 */
function balanceDelta(kind: string, amount: number, status: string): number {
  const a = Number(amount) || 0;
  if (kind === "extra_route" && status === "pending") return +a;
  if (kind === "extra_route") return 0;
  if (status !== "paid") return 0;
  if (kind === "advance" || kind === "fine") return -a;
  if (kind === "return" || kind === "salary") return +a;
  return 0;
}

function mapTxn(kind: string, status: string): {
  txnType: PartyTxnType;
  itemName: string;
  paid: boolean;
  effect: string;
} {
  switch (kind) {
    case "salary":
      return {
        txnType: "Purchase",
        itemName: "Driver Service (Salary)",
        paid: false,
        effect: "Salary slip · company owes more",
      };
    case "bonus":
      return {
        txnType: "Info",
        itemName: "Bonus",
        paid: false,
        effect: "Bonus noted · does not change running balance",
      };
    case "extra_route":
      if (status === "pending") {
        return {
          txnType: "Purchase",
          itemName: "Extra work (unpaid)",
          paid: false,
          effect: "Unpaid extra · company owes more",
        };
      }
      return {
        txnType: "Payment-out",
        itemName: "Extra work (paid)",
        paid: true,
        effect: "Paid extra · cash only, balance unchanged",
      };
    case "advance":
      return {
        txnType: "Payment-out",
        itemName: "Advance",
        paid: true,
        effect: "Advance paid · reduces company payable / increases receivable",
      };
    case "return":
      return {
        txnType: "Payment-in",
        itemName: "Return from driver",
        paid: true,
        effect: "Return received · reduces what driver owes",
      };
    case "fine":
      return {
        txnType: "Sale",
        itemName: "Fine / deduction",
        paid: false,
        effect: "Fine · driver owes more",
      };
    default:
      return {
        txnType: "Payment-out",
        itemName: kind,
        paid: status === "paid",
        effect: "",
      };
  }
}

function modeLabel(mode: string, bankName: string) {
  if (mode === "cash") return "Cash";
  if (mode === "upi") return bankName ? `UPI · ${bankName}` : "UPI";
  if (mode === "bank") return bankName || "Bank";
  return bankName || mode || "—";
}

function balanceWords(bal: number): string {
  if (Math.abs(bal) < 0.005) return "Settled (₹0)";
  if (bal > 0) return `Company owes driver ${inrDec(bal)}`;
  return `Driver owes company ${inrDec(Math.abs(bal))}`;
}

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

  let bal = Number(driver.openingBalance) || 0;
  for (const p of allForDriver) {
    const d = String(p.date || "").slice(0, 10);
    if (!d || d >= from) continue;
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

    if (delta === 0 && p.status !== "paid" && p.kind !== "extra_route" && p.kind !== "bonus") {
      continue;
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
      effect: mapped.effect,
    });
  }

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
    closingBalance: bal,
  };
}

export function partyStatementHtml(d: PartyStatementData): string {
  const rowHtml = d.rows
    .map((r) => {
      const bal = r.balanceAfter;
      const balCell = inrDec(bal);
      const balClass = bal < 0 ? "neg" : bal > 0 ? "pos" : "";

      const itemsBlock =
        r.items.length > 0
          ? `<tr class="items"><td colspan="6">
              <table class="inner">
                <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
                <tbody>
                  ${r.items
                    .map(
                      (it, i) =>
                        `<tr><td>${i + 1}</td><td>${escapeHtml(it.name)}</td><td>${it.qty ?? ""}</td><td>${it.price != null ? inrDec(it.price) : ""}</td><td>${inrDec(it.amount)}</td></tr>`,
                    )
                    .join("")}
                </tbody>
              </table>
            </td></tr>`
          : "";

      return (
        `<tr class="txn">
          <td class="d">${escapeHtml(fmtDate(r.date))}</td>
          <td class="t"><strong>${escapeHtml(r.txnType)}</strong></td>
          <td class="num">${inrDec(r.totalAmount)}</td>
          <td class="num">${r.paidAmount ? inrDec(r.paidAmount) : "—"}</td>
          <td class="num bal ${balClass}">${balCell}</td>
          <td class="side">${bal < 0 ? "Driver owes" : bal > 0 ? "Co. owes" : "Settled"}</td>
        </tr>
        ${itemsBlock}
        <tr class="meta"><td colspan="6">
          <span class="lbl">Note:</span> ${escapeHtml(r.description || "—")}
          ${r.paymentType ? ` · <span class="lbl">Paid via:</span> ${escapeHtml(r.paymentType)}` : ""}
          ${r.effect ? ` · <span class="fx">${escapeHtml(r.effect)}</span>` : ""}
        </td></tr>`
      );
    })
    .join("\n");

  const openBal = d.openingBalance;
  const closeBal = d.closingBalance;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Party Statement — ${escapeHtml(d.driverName)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    margin: 0;
    padding: 14px;
    color: #111;
    font-size: 11px;
    background: #fff;
    line-height: 1.35;
  }
  .sheet { max-width: 820px; margin: 0 auto; }
  .hdr { text-align: center; margin-bottom: 10px; }
  .hdr h1 { margin: 0; font-size: 18px; font-weight: 700; }
  .hdr .addr { margin: 3px 0 0; font-size: 10px; color: #444; }
  h2 {
    text-align: center;
    margin: 10px 0 8px;
    font-size: 14px;
    text-decoration: underline;
    font-weight: 700;
  }
  .party { margin-bottom: 10px; font-size: 11px; line-height: 1.45; }
  .party strong { font-weight: 700; }

  .summary {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0 0 12px;
  }
  .summary .box {
    flex: 1 1 140px;
    border: 1px solid #333;
    padding: 8px 10px;
    background: #fafafa;
  }
  .summary .box .k { font-size: 9px; text-transform: uppercase; letter-spacing: .04em; color: #555; }
  .summary .box .v { font-size: 14px; font-weight: 700; margin-top: 2px; font-variant-numeric: tabular-nums; }
  .summary .box .w { font-size: 10px; color: #444; margin-top: 2px; }
  .summary .box.neg .v { color: #b45309; }
  .summary .box.pos .v { color: #047857; }

  table.main { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  table.main th {
    background: #f0f0f0;
    border: 1px solid #333;
    padding: 5px 4px;
    text-align: center;
    font-weight: 700;
    font-size: 10px;
  }
  table.main td {
    border: 1px solid #bbb;
    padding: 4px;
    vertical-align: top;
  }
  table.main td.num {
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  table.main td.bal { font-weight: 700; }
  table.main td.bal.neg { color: #b45309; }
  table.main td.bal.pos { color: #047857; }
  table.main td.side { font-size: 9px; color: #555; white-space: nowrap; }
  table.main td.d { white-space: nowrap; width: 72px; }
  table.main td.t { width: 88px; }

  tr.meta td {
    border-top: none;
    border-bottom: 1px solid #333;
    padding: 2px 6px 6px;
    font-size: 9px;
    color: #444;
    line-height: 1.35;
  }
  tr.meta .lbl { font-weight: 600; color: #333; }
  tr.meta .fx { color: #666; font-style: italic; }

  tr.items td { border-top: none; border-bottom: none; padding: 0 6px 4px; }
  table.inner { width: 100%; border-collapse: collapse; font-size: 9.5px; margin-top: 2px; }
  table.inner th { background: #eee; border: 1px solid #999; padding: 2px 4px; text-align: left; font-size: 9px; }
  table.inner td { border: 1px solid #ccc; padding: 2px 4px; }

  tr.opening td { background: #f5f5f5; font-weight: 600; }

  .legend {
    margin-top: 12px;
    font-size: 9.5px;
    color: #444;
    border: 1px solid #ddd;
    padding: 8px 10px;
    background: #fafafa;
    line-height: 1.45;
  }
  .legend strong { color: #111; }
  .footer {
    margin-top: 12px;
    font-size: 12px;
    font-weight: 700;
    text-align: right;
  }
  .note { margin-top: 6px; font-size: 9px; color: #666; text-align: right; }

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
    <div class="addr">Address: ${escapeHtml(d.address)} · Ph.: ${escapeHtml(d.phone)} · Email: ${escapeHtml(d.email)}</div>
  </div>
  <h2>Party Statement</h2>
  <div class="party">
    <div><strong>Party name:</strong> Driver ${escapeHtml(d.driverName)}</div>
    <div><strong>Contact no.:</strong> ${d.mobile ? escapeHtml(d.mobile) : "—"}</div>
    <div><strong>Duration:</strong> From ${escapeHtml(fmtDate(d.from))} to ${escapeHtml(fmtDate(d.to))}</div>
  </div>

  <div class="summary">
    <div class="box ${openBal < 0 ? "neg" : openBal > 0 ? "pos" : ""}">
      <div class="k">Opening balance</div>
      <div class="v">${inrDec(openBal)}</div>
      <div class="w">${escapeHtml(balanceWords(openBal))}</div>
    </div>
    <div class="box ${closeBal < 0 ? "neg" : closeBal > 0 ? "pos" : ""}">
      <div class="k">Closing balance</div>
      <div class="v">${inrDec(closeBal)}</div>
      <div class="w">${escapeHtml(balanceWords(closeBal))}</div>
    </div>
  </div>

  <table class="main">
    <thead>
      <tr>
        <th>Date</th>
        <th>Txn Type</th>
        <th>Amount</th>
        <th>Paid</th>
        <th>Running bal</th>
        <th>Who owes</th>
      </tr>
    </thead>
    <tbody>
      <tr class="opening">
        <td class="d">${escapeHtml(fmtDate(d.from))}</td>
        <td colspan="3"><em>Opening</em></td>
        <td class="num bal ${openBal < 0 ? "neg" : openBal > 0 ? "pos" : ""}">${inrDec(openBal)}</td>
        <td class="side">${openBal < 0 ? "Driver owes" : openBal > 0 ? "Co. owes" : "Settled"}</td>
      </tr>
      ${
        rowHtml ||
        `<tr><td colspan="6" style="text-align:center;padding:14px;color:#666">No transactions in this period</td></tr>`
      }
    </tbody>
  </table>

  <div class="footer">
    Closing: ${escapeHtml(balanceWords(closeBal))}
  </div>

  <div class="legend">
    <strong>How to read balance (same as Drivers tab)</strong><br/>
    <strong>+</strong> (green) = company owes the driver &nbsp;·&nbsp;
    <strong>−</strong> (orange) = driver owes the company<br/>
    Salary slip &amp; unpaid extra work increase company payable.
    Advance &amp; fine reduce it (or increase what driver owes).
    Bonus and paid extra work are shown but <em>do not</em> change running balance.
  </div>
  <p class="note">Generated ${escapeHtml(fmtDate(new Date().toISOString().slice(0, 10)))} · ${escapeHtml(d.company)}</p>
  <p class="noprint" style="text-align:center;margin-top:16px">
    <button onclick="window.print()" style="padding:8px 16px;font-size:13px;cursor:pointer">Print / Save as PDF</button>
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
