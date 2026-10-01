import {
  daysInMonth,
  inr,
  monthLabel,
  openWhatsApp,
  prevMonthISO,
  salarySettlement,
  suggestedSalary,
} from "./format";
import type { Driver, Fleet, Payout } from "./types";

export type SalarySlipData = {
  company: string;
  driverName: string;
  mobile: string;
  month: string;
  monthLabel: string;
  date: string;
  daysInMonth: number;
  baseSalary: number;
  leaveDays: number;
  presentDays: number;
  leaveAmount: number;
  gross: number;
  bonus: number;
  rentFull: number;
  rentOffDays: number;
  rentDays: number;
  rent: number;
  rentFleetName: string | null;
  deduction: number;
  balanceBefore: number;
  slipAmount: number;
  balanceAfter: number;
  note?: string;
};

const COMPANY = "Satelkars Logistic";

function fullMonthSalary(
  driver: { kind: string; baseSalary: number; dailyRate: number },
  month: string,
): number {
  return suggestedSalary(driver, 0, month);
}

export function buildSalarySlipData(input: {
  driver: Driver;
  month: string;
  date: string;
  leaveDays: number;
  payouts: Payout[];
  fleets: Fleet[];
  bonus?: number;
  deduction?: number;
  rentOffDays?: number;
  slipAmountOverride?: number;
}): SalarySlipData {
  const settle = salarySettlement({
    driver: input.driver,
    leaveDays: input.leaveDays,
    month: input.month,
    payouts: input.payouts,
    fleets: input.fleets,
    bonus: input.bonus || 0,
    deduction: input.deduction || 0,
    rentOffDays: input.rentOffDays || 0,
  });
  const dim = daysInMonth(input.month);
  const leave = Math.max(0, Math.min(dim, Math.floor(input.leaveDays) || 0));
  const present = Math.max(0, dim - leave);
  const baseSalary = fullMonthSalary(input.driver, input.month);
  const leaveAmount = Math.max(0, Math.round((baseSalary - settle.gross) * 100) / 100);

  const rentFull = settle.rentFull || 0;
  const rentOff = settle.rentOffDays || 0;
  const rentDays = rentFull > 0 ? Math.max(0, dim - rentOff) : 0;

  const slip =
    input.slipAmountOverride != null && input.slipAmountOverride > 0
      ? input.slipAmountOverride
      : Math.round((settle.gross + settle.bonus - settle.rent - settle.deduction) * 100) / 100;
  const alreadyPosted = input.payouts.some(
    (p) =>
      p.driverId === input.driver.id &&
      p.kind === "salary" &&
      p.status === "paid" &&
      Math.abs(p.amount - slip) < 0.02 &&
      p.date.startsWith(input.month.slice(0, 7)),
  );
  const balanceAfter = alreadyPosted
    ? settle.balance
    : Math.round((settle.balance + slip) * 100) / 100;
  const balanceBefore = Math.round((balanceAfter - slip) * 100) / 100;

  return {
    company: COMPANY,
    driverName: input.driver.name,
    mobile: input.driver.mobile || "",
    month: input.month,
    monthLabel: monthLabel(input.month),
    date: input.date,
    daysInMonth: dim,
    baseSalary,
    leaveDays: leave,
    presentDays: present,
    leaveAmount,
    gross: settle.gross,
    bonus: settle.bonus,
    rentFull,
    rentOffDays: rentOff,
    rentDays,
    rent: settle.rent,
    rentFleetName: settle.rentFleetName,
    deduction: settle.deduction,
    balanceBefore,
    slipAmount: slip,
    balanceAfter,
  };
}

export function salarySlipWhatsAppText(d: SalarySlipData): string {
  const lines = [
    "*" + d.company + "*",
    "*Salary slip - " + d.monthLabel + "*",
    "",
    "Driver: " + d.driverName,
    "Date: " + d.date,
    "",
    "1. Monthly salary: " + inr(d.baseSalary),
    "2. Leave: " +
      d.leaveDays +
      " day(s)" +
      (d.leaveAmount > 0 ? " · −" + inr(d.leaveAmount) : "") +
      " → Gross " +
      inr(d.gross),
    "3. Bonus: " + (d.bonus > 0 ? "+" + inr(d.bonus) : "—"),
    "4. Advance / earlier balance: " +
      (d.balanceBefore < 0
        ? "−" + inr(Math.abs(d.balanceBefore)) + " (advance taken)"
        : inr(d.balanceBefore)),
  ];
  if (d.rent > 0 || d.rentFull > 0) {
    lines.push(
      "5. Tempo rent: " +
        d.rentDays +
        "/" +
        d.daysInMonth +
        " day(s)" +
        (d.rentFleetName ? " (" + d.rentFleetName + ")" : "") +
        " · −" +
        inr(d.rent),
    );
  } else {
    lines.push("5. Tempo rent: —");
  }
  lines.push("6. Deduction: " + (d.deduction > 0 ? "−" + inr(d.deduction) : "—"));
  lines.push("");
  lines.push("7. *Salary slip amount: " + inr(d.slipAmount) + "*");
  lines.push(
    d.balanceAfter >= 0
      ? "*Final · Company owes: " + inr(d.balanceAfter) + "*"
      : "*Final · Still over-advanced: " + inr(Math.abs(d.balanceAfter)) + "*",
  );
  lines.push("");
  lines.push("_Account slip only. Cash paid later as advance._");
  return lines.join("\n");
}

function escapeHtml(s: string) {
  const e = (name: string) => String.fromCharCode(38) + name + ";";
  return String(s)
    .replace(/&/g, e("amp"))
    .replace(/</g, e("lt"))
    .replace(/>/g, e("gt"))
    .replace(/"/g, e("quot"));
}

export function salarySlipHtml(d: SalarySlipData): string {
  const row = (label: string, value: string, opts?: { bold?: boolean; sub?: string }) => {
    const bold = opts?.bold;
    const sub = opts?.sub
      ? "<div style=\"font-size:11px;color:#888;margin-top:2px\">" + escapeHtml(opts.sub) + "</div>"
      : "";
    return (
      "<tr><td style=\"padding:10px 0;color:#555;border-bottom:1px solid #eee;vertical-align:top\">" +
      escapeHtml(label) +
      sub +
      "</td><td style=\"padding:10px 0;text-align:right;border-bottom:1px solid #eee;vertical-align:top;" +
      (bold ? "font-weight:700;font-size:16px;color:#111" : "") +
      "\">" +
      escapeHtml(value) +
      "</td></tr>"
    );
  };

  const leaveValue =
    d.leaveDays > 0
      ? d.leaveDays + " day(s)" + (d.leaveAmount > 0 ? " · −" + inr(d.leaveAmount) : "")
      : "0 day(s)";
  const leaveSub =
    d.leaveDays > 0
      ? "Present " + d.presentDays + "/" + d.daysInMonth + " → gross " + inr(d.gross)
      : "Full month · gross " + inr(d.gross);

  const advValue =
    d.balanceBefore < 0
      ? "− " + inr(Math.abs(d.balanceBefore))
      : inr(d.balanceBefore);
  const advSub =
    d.balanceBefore < 0 ? "Advance already taken / driver owes" : "Earlier balance (company side)";

  const rentValue = d.rent > 0 || d.rentFull > 0 ? "− " + inr(d.rent) : "—";
  const rentSub =
    d.rentFull > 0
      ? (d.rentFleetName ? d.rentFleetName + " · " : "") +
        "Charged " +
        d.rentDays +
        "/" +
        d.daysInMonth +
        " day(s)" +
        (d.rentOffDays > 0 ? " · off " + d.rentOffDays + "d" : "") +
        (d.rentFull !== d.rent ? " · full " + inr(d.rentFull) : "")
      : "No tempo on rent";

  const netLine =
    d.balanceAfter >= 0
      ? "Company owes " + inr(d.balanceAfter)
      : "Over-advanced " + inr(Math.abs(d.balanceAfter));

  return (
    "<!DOCTYPE html><html><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/>" +
    "<title>Salary slip - " +
    escapeHtml(d.driverName) +
    "</title><style>" +
    "body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:24px;color:#111;background:#f5f5f5}" +
    ".sheet{max-width:420px;margin:0 auto;background:#fff;border-radius:12px;padding:28px 24px;box-shadow:0 2px 12px rgba(0,0,0,.08)}" +
    ".hdr{text-align:center;border-bottom:2px solid #0f2744;padding-bottom:16px;margin-bottom:16px}" +
    ".hdr h1{margin:0;font-size:20px;letter-spacing:.02em;color:#0f2744}" +
    ".hdr p{margin:6px 0 0;font-size:13px;color:#666}" +
    "table{width:100%;border-collapse:collapse;font-size:14px}" +
    ".foot{margin-top:18px;font-size:11px;color:#888;text-align:center;line-height:1.4}" +
    "@media print{body{background:#fff;padding:0}.sheet{box-shadow:none;max-width:none}}" +
    "</style></head><body><div class=\"sheet\"><div class=\"hdr\"><h1>" +
    escapeHtml(d.company) +
    "</h1><p>Salary slip · " +
    escapeHtml(d.monthLabel) +
    "</p></div><p style=\"margin:0 0 4px;font-size:15px;font-weight:600\">" +
    escapeHtml(d.driverName) +
    "</p><p style=\"margin:0 0 16px;font-size:12px;color:#666\">Date: " +
    escapeHtml(d.date) +
    "</p><table>" +
    row("1. Monthly salary", inr(d.baseSalary), {
      sub: "Full month before leave",
    }) +
    row("2. Leave", leaveValue, { sub: leaveSub }) +
    row("3. Bonus", d.bonus > 0 ? "+ " + inr(d.bonus) : "—") +
    row("4. Advance / earlier balance", advValue, { sub: advSub }) +
    row("5. Tempo rent", rentValue, { sub: rentSub }) +
    row("6. Deduction", d.deduction > 0 ? "− " + inr(d.deduction) : "—") +
    row("7. Salary slip amount", inr(d.slipAmount), {
      bold: true,
      sub: "Gross + bonus − rent − deduction",
    }) +
    row("Final (net payable)", netLine, { bold: true }) +
    "</table><p class=\"foot\">This is an account slip only.<br/>Cash is paid later as advance (~10th).</p></div>" +
    "<script>window.onload=function(){setTimeout(function(){try{window.print()}catch(e){}},400)}<\/script></body></html>"
  );
}

export function printSalarySlip(d: SalarySlipData) {
  const html = salarySlipHtml(d);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) {
    downloadBlob(blob, "salary-slip-" + d.driverName.replace(/\s+/g, "-") + ".html");
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function downloadSalarySlipPdf(d: SalarySlipData) {
  const lines: string[] = [
    d.company,
    "Salary slip - " + d.monthLabel,
    "",
    "Driver: " + d.driverName,
    "Date: " + d.date,
    "",
    "1. Monthly salary: " + inr(d.baseSalary),
    "2. Leave: " +
      d.leaveDays +
      " day(s)" +
      (d.leaveAmount > 0 ? " (-" + inr(d.leaveAmount) + ")" : "") +
      " -> Gross " +
      inr(d.gross),
    "3. Bonus: " + (d.bonus > 0 ? "+" + inr(d.bonus) : "-"),
    "4. Advance / earlier balance: " +
      (d.balanceBefore < 0 ? "-" + inr(Math.abs(d.balanceBefore)) : inr(d.balanceBefore)),
  ];
  if (d.rent > 0 || d.rentFull > 0) {
    lines.push(
      "5. Tempo rent: " +
        d.rentDays +
        "/" +
        d.daysInMonth +
        " days -" +
        inr(d.rent),
    );
  } else {
    lines.push("5. Tempo rent: -");
  }
  lines.push("6. Deduction: " + (d.deduction > 0 ? "-" + inr(d.deduction) : "-"));
  lines.push("7. Salary slip amount: " + inr(d.slipAmount));
  lines.push(
    d.balanceAfter >= 0
      ? "Final - Company owes: " + inr(d.balanceAfter)
      : "Final - Over-advanced: " + inr(Math.abs(d.balanceAfter)),
  );
  lines.push("");
  lines.push("Account slip only. Cash paid later as advance.");

  const pdf = buildSimplePdf(lines);
  const name = "salary-slip-" + d.driverName.replace(/\s+/g, "-") + "-" + d.month + ".pdf";
  downloadBlob(new Blob([pdf], { type: "application/pdf" }), name);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function shareSalarySlipWhatsApp(d: SalarySlipData) {
  openWhatsApp(d.mobile || "", salarySlipWhatsAppText(d));
}

function buildSimplePdf(lines: string[]): Uint8Array {
  const esc = (s: string) =>
    s.split("\\").join("\\\\").split("(").join("\\(").split(")").join("\\)");
  const contentLines: string[] = ["BT", "/F1 11 Tf", "50 780 Td", "14 TL"];
  lines.forEach((line, i) => {
    if (i === 0) contentLines.push("(" + esc(line) + ") Tj");
    else contentLines.push("T* (" + esc(line) + ") Tj");
  });
  contentLines.push("ET");
  const stream = contentLines.join("\n");
  const objects: string[] = [];
  objects.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n");
  objects.push("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n");
  objects.push(
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n",
  );
  objects.push("4 0 obj<< /Length " + stream.length + " >>stream\n" + stream + "\nendstream\nendobj\n");
  objects.push("5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n");

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefPos = pdf.length;
  pdf += "xref\n0 " + (objects.length + 1) + "\n";
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  pdf += "trailer<< /Size " + (objects.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xrefPos + "\n%%EOF";
  return new TextEncoder().encode(pdf);
}

export function resolveSalarySlipMeta(
  payout: Payout,
  driverId: string,
  attendances: { driverId: string; month: string; leaveDays: number }[],
): { month: string; leaveDays: number; bonus: number; deduction: number } {
  const note = String(payout.note || "");
  const payYm = String(payout.date || "").slice(0, 7);

  const ymMatch = note.match(/(?:Salary slip|ym:)\s*(\d{4}-\d{2})/i);
  let month = ymMatch?.[1] || "";

  const leaveMatch = note.match(/leave\s+(\d+)/i);
  let leaveDays =
    leaveMatch && Number.isFinite(Number(leaveMatch[1]))
      ? Math.max(0, Math.floor(Number(leaveMatch[1])))
      : NaN;

  const bonusMatch = note.match(/bonus\s+([0-9]+(?:\.[0-9]+)?)/i);
  const deductMatch = note.match(/deduct(?:ion)?\s+([0-9]+(?:\.[0-9]+)?)/i);
  const bonus =
    bonusMatch && Number.isFinite(Number(bonusMatch[1]))
      ? Math.max(0, Math.round(Number(bonusMatch[1]) * 100) / 100)
      : 0;
  const deduction =
    deductMatch && Number.isFinite(Number(deductMatch[1]))
      ? Math.max(0, Math.round(Number(deductMatch[1]) * 100) / 100)
      : 0;

  if (!month) {
    month = payYm && /^\d{4}-\d{2}$/.test(payYm) ? prevMonthISO(payYm) : payYm;
  }

  if (!Number.isFinite(leaveDays)) {
    const attSame = attendances.find((a) => a.driverId === driverId && a.month === month);
    if (attSame && (attSame.leaveDays ?? 0) > 0) {
      leaveDays = Math.max(0, Math.floor(Number(attSame.leaveDays) || 0));
    } else {
      const attPay = attendances.find((a) => a.driverId === driverId && a.month === payYm);
      if (attPay) leaveDays = Math.max(0, Math.floor(Number(attPay.leaveDays) || 0));
      else leaveDays = 0;
    }
  }

  return {
    month,
    leaveDays: Math.max(0, leaveDays || 0),
    bonus,
    deduction,
  };
}

export function slipFromSalaryPayout(
  driver: Driver,
  payout: Payout,
  payouts: Payout[],
  fleets: Fleet[],
  leaveDays: number,
  attendances: { driverId: string; month: string; leaveDays: number }[] = [],
): SalarySlipData {
  const meta = resolveSalarySlipMeta(payout, driver.id, attendances);
  const leaves = meta.leaveDays > 0 ? meta.leaveDays : Math.max(0, leaveDays || 0);
  const month = meta.month || String(payout.date || "").slice(0, 7);
  return buildSalarySlipData({
    driver,
    month,
    date: payout.date,
    leaveDays: leaves,
    payouts,
    fleets,
    bonus: meta.bonus,
    deduction: meta.deduction,
    slipAmountOverride: payout.amount,
  });
}
