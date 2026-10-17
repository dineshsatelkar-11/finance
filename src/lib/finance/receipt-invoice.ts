/** Printable payment-received invoice for customer receipts. */

import { inr, shortDate } from "./format";
import type { PayMode, Receipt } from "./types";

const COMPANY = "Satelkars Logistic";

export type ReceiptInvoiceData = {
  company: string;
  receiptNo: string;
  customerName: string;
  customerMobile?: string;
  amount: number;
  date: string;
  mode: PayMode;
  status: string;
  fleetName?: string;
  bankName?: string;
  note?: string;
};

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function modeLabel(mode: PayMode) {
  if (mode === "upi") return "UPI";
  if (mode === "cash") return "Cash";
  if (mode === "bank") return "Bank transfer";
  return String(mode).toUpperCase();
}

/** Short human receipt number from id + date. */
export function receiptNumber(r: Pick<Receipt, "id" | "date">) {
  const tail = (r.id || "").replace(/^rc_?/, "").slice(-6).toUpperCase() || "000000";
  const d = (r.date || "").replace(/-/g, "").slice(2) || "";
  return d ? `R-${d}-${tail}` : `R-${tail}`;
}

export function buildReceiptInvoiceData(
  r: Receipt,
  opts?: { customerMobile?: string; fleetName?: string; bankName?: string },
): ReceiptInvoiceData {
  return {
    company: COMPANY,
    receiptNo: receiptNumber(r),
    customerName: r.customerName || "Customer",
    customerMobile: opts?.customerMobile || "",
    amount: r.amount,
    date: r.date,
    mode: r.mode,
    status: r.status || "paid",
    fleetName: opts?.fleetName || "",
    bankName: opts?.bankName || "",
    note: r.note || "",
  };
}

export function receiptInvoiceHtml(d: ReceiptInvoiceData) {
  const rows: string[] = [];
  const add = (label: string, value: string, opts?: { bold?: boolean }) => {
    const weight = opts?.bold ? "font-weight:700" : "font-weight:500";
    rows.push(
      "<tr><td style=\"padding:10px 0;color:#555;border-bottom:1px solid #eee\">" +
        escapeHtml(label) +
        '</td><td style="padding:10px 0;text-align:right;border-bottom:1px solid #eee;' +
        weight +
        '">' +
        escapeHtml(value) +
        "</td></tr>",
    );
  };

  add("Receipt no.", d.receiptNo);
  add("Date", shortDate(d.date));
  add("Payment mode", modeLabel(d.mode));
  if (d.fleetName) add("Vehicle / fleet", d.fleetName);
  if (d.bankName) add("Received in", d.bankName);
  if (d.note) add("Note", d.note);
  add("Amount received", inr(d.amount), { bold: true });

  return (
    "<!DOCTYPE html><html><head><meta charset=\"utf-8\"/>" +
    '<meta name="viewport" content="width=device-width,initial-scale=1"/>' +
    "<title>Invoice - " +
    escapeHtml(d.customerName) +
    "</title><style>" +
    "body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:24px;color:#111;background:#f5f5f5}" +
    ".sheet{max-width:440px;margin:0 auto;background:#fff;border-radius:12px;padding:28px 24px;box-shadow:0 2px 12px rgba(0,0,0,.08)}" +
    ".hdr{text-align:center;border-bottom:2px solid #0f2744;padding-bottom:16px;margin-bottom:18px}" +
    ".hdr h1{margin:0;font-size:20px;letter-spacing:.02em;color:#0f2744}" +
    ".hdr p{margin:6px 0 0;font-size:13px;color:#666}" +
    "table{width:100%;border-collapse:collapse;font-size:14px}" +
    ".amt{margin:18px 0 8px;text-align:center;padding:14px;background:#f0f7f2;border-radius:10px}" +
    ".amt .lbl{font-size:12px;color:#666;text-transform:uppercase;letter-spacing:.04em}" +
    ".amt .val{font-size:28px;font-weight:700;color:#0a7a3e;margin-top:4px}" +
    ".foot{margin-top:20px;font-size:11px;color:#888;text-align:center;line-height:1.45}" +
    "@media print{body{background:#fff;padding:0}.sheet{box-shadow:none;max-width:none}}" +
    "</style></head><body><div class=\"sheet\"><div class=\"hdr\"><h1>" +
    escapeHtml(d.company) +
    "</h1><p>Payment receipt / invoice</p></div>" +
    '<p style="margin:0 0 2px;font-size:15px;font-weight:600">Bill to</p>' +
    '<p style="margin:0 0 4px;font-size:16px;font-weight:600">' +
    escapeHtml(d.customerName) +
    "</p>" +
    (d.customerMobile
      ? '<p style="margin:0 0 12px;font-size:12px;color:#666">' +
        escapeHtml(d.customerMobile) +
        "</p>"
      : '<p style="margin:0 0 12px"></p>') +
    '<div class="amt"><div class="lbl">Amount received</div><div class="val">' +
    escapeHtml(inr(d.amount)) +
    "</div></div>" +
    "<table>" +
    rows.join("") +
    "</table>" +
    '<p class="foot">This is a computer-generated receipt from ' +
    escapeHtml(d.company) +
    ".<br/>Thank you for your payment.</p></div>" +
    "<script>window.onload=function(){setTimeout(function(){try{window.print()}catch(e){}},400)}<\/script></body></html>"
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function printReceiptInvoice(d: ReceiptInvoiceData) {
  const html = receiptInvoiceHtml(d);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) {
    const safe = (d.customerName || "customer").replace(/\s+/g, "-").replace(/[^\w\-]+/g, "");
    downloadBlob(blob, "invoice-" + safe + "-" + d.receiptNo + ".html");
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
