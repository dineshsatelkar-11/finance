import { inr, monthLabel, openWhatsApp, prevMonthISO, salarySettlement } from "./format";
import type { Driver, Fleet, Payout } from "./types";

export type SalarySlipData = {
  company: string;
  driverName: string;
  mobile: string;
  month: string;
  monthLabel: string;
  date: string;
  leaveDays: number;
  gross: number;
  bonus: number;
  rent: number;
  deduction: number;
  balanceBefore: number;
  slipAmount: number;
  balanceAfter: number;
  note?: string;
};

const COMPANY = "Satelkars Logistic";

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
    leaveDays: input.leaveDays,
    gross: settle.gross,
    bonus: settle.bonus,
    rent: settle.rent,
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
    "Gross salary: " + inr(d.gross),
    "Total leave: " + d.leaveDays + " day(s)",
  ];
  if (d.bonus > 0) lines.push("Bonus: +" + inr(d.bonus));
  if (d.rent > 0) lines.push("Tempo rent: -" + inr(d.rent));
  if (d.deduction > 0) lines.push("Deduction: -" + inr(d.deduction));
  lines.push(
    d.balanceBefore < 0
      ? "Advance / earlier balance: -" + inr(Math.abs(d.balanceBefore))
      : "Earlier balance: " + inr(d.balanceBefore),
  );
  lines.push("*Salary slip: " + inr(d.slipAmount) + "*");
  lines.push(
    d.balanceAfter >= 0
      ? "*Net payable (company owes): " + inr(d.balanceAfter) + "*"
      : "*Still over-advanced: " + inr(Math.abs(d.balanceAfter)) + "*",
  );
  lines.push("");
  lines.push("_Account slip only. Cash paid later as advance._");
  return lines.join("\n");
}

function escapeHtml(s: string) {
  // Build entities without literal & so APIs cannot strip them.
  const e = (name: string) => String.fromCharCode(38) + name + ";";
  return String(s)
    .replace(/&/g, e("amp"))
    .replace(/</g, e("lt"))
    .replace(/>/g, e("gt"))
    .replace(/"/g, e("quot"));
}

export function salarySlipHtml(d: SalarySlipData): string {
  const row = (label: string, value: string, bold = false) =>
    "<tr><td style=\"padding:8px 0;color:#555;border-bottom:1px solid #eee\">" +
    escapeHtml(label) +
    "</td><td style=\"padding:8px 0;text-align:right;border-bottom:1px solid #eee;" +
    (bold ? "font-weight:700;font-size:16px" : "") +
    "\">" +
    escapeHtml(value) +
    "</td></tr>";

  const balBefore =
    d.balanceBefore < 0
      ? "- " + inr(Math.abs(d.balanceBefore)) + " (advance)"
      : inr(d.balanceBefore);
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
    row("Gross salary", inr(d.gross)) +
    row("Total leave", String(d.leaveDays) + " day(s)") +
    (d.bonus > 0 ? row("Bonus", "+ " + inr(d.bonus)) : "") +
    (d.rent > 0 ? row("Tempo rent", "- " + inr(d.rent)) : "") +
    (d.deduction > 0 ? row("Deduction", "- " + inr(d.deduction)) : "") +
    row("Advance / earlier balance", balBefore) +
    row("Salary slip amount", inr(d.slipAmount), true) +
    row("Net payable", netLine, true) +
    "</table><p class=\"foot\">This is an account slip only.<br/>Cash is paid later as advance (~10th).</p></div>" +
    "<script>window.onload=function(){setTimeout(function(){try{window.print()}catch(e){}},400)}<\/script></body></html>"
  );
}

/** Open slip in new tab via blob URL (avoids blank popup from document.write + noopener). */
export function printSalarySlip(d: SalarySlipData) {
  const html = salarySlipHtml(d);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) {
    // Popup blocked — fall back to download
    downloadBlob(blob, "salary-slip-" + d.driverName.replace(/\s+/g, "-") + ".html");
  }
  // Revoke after the new tab has had time to load
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
    "Gross salary: " + inr(d.gross),
    "Total leave: " + d.leaveDays + " day(s)",
  ];
  if (d.bonus > 0) lines.push("Bonus: +" + inr(d.bonus));
  if (d.rent > 0) lines.push("Tempo rent: -" + inr(d.rent));
  if (d.deduction > 0) lines.push("Deduction: -" + inr(d.deduction));
  lines.push(
    d.balanceBefore < 0
      ? "Advance / earlier balance: -" + inr(Math.abs(d.balanceBefore))
      : "Earlier balance: " + inr(d.balanceBefore),
  );
  lines.push("Salary slip amount: " + inr(d.slipAmount));
  lines.push(
    d.balanceAfter >= 0
      ? "Net payable (company owes): " + inr(d.balanceAfter)
      : "Still over-advanced: " + inr(Math.abs(d.balanceAfter)),
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

/**
 * Resolve salary-month + leave for an existing salary payout.
 * Leave is often stored under the *work* month (e.g. Sep), while the payout
 * date is when the slip was posted (e.g. Oct). Note usually has "leave N".
 */
export function resolveSalarySlipMeta(
  payout: Payout,
  driverId: string,
  attendances: { driverId: string; month: string; leaveDays: number }[],
): { month: string; leaveDays: number } {
  const note = String(payout.note || "");
  const payYm = String(payout.date || "").slice(0, 7);

  // Prefer explicit ISO month in note: "Salary slip 2026-09 · leave 22"
  const ymMatch = note.match(/(?:Salary slip|ym:)\s*(\d{4}-\d{2})/i);
  let month = ymMatch?.[1] || "";

  // Leave from note
  const leaveMatch = note.match(/leave\s+(\d+)/i);
  let leaveDays =
    leaveMatch && Number.isFinite(Number(leaveMatch[1]))
      ? Math.max(0, Math.floor(Number(leaveMatch[1])))
      : NaN;

  if (!month) {
    // Typical: salary for previous calendar month, posted this month
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

  return { month, leaveDays: Math.max(0, leaveDays || 0) };
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
  // Caller leave only if > 0 and note/attendance had none — prefer meta
  const leaves = meta.leaveDays > 0 ? meta.leaveDays : Math.max(0, leaveDays || 0);
  const month = meta.month || String(payout.date || "").slice(0, 7);
  return buildSalarySlipData({
    driver,
    month,
    date: payout.date,
    leaveDays: leaves,
    payouts,
    fleets,
    slipAmountOverride: payout.amount,
  });
}
