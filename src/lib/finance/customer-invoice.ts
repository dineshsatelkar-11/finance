/** Printable / shareable billing invoice for customers (amount due). */

import { inr, shortDate } from "./format";
import type { Invoice, PayMode } from "./types";

const COMPANY = "Satelkars Logistic";

export type CustomerInvoicePrintData = {
  company: string;
  invoiceNo: string;
  customerName: string;
  customerMobile?: string;
  invoiceDate: string;
  dueDate: string;
  description: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  fleetName?: string;
  forMonth?: string;
  status: string;
  note?: string;
};

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """);
}

export function makeInvoiceNo(date: string, id: string) {
  const d = (date || "").replace(/-/g, "").slice(2) || "000000";
  const tail = (id || "").replace(/^inv_?/, "").slice(-4).toUpperCase() || "0000";
  return `INV-${d}-${tail}`;
}

export function buildCustomerInvoiceData(
  inv: Invoice,
  opts?: { fleetName?: string },
): CustomerInvoicePrintData {
  return {
    company: COMPANY,
    invoiceNo: inv.invoiceNo || makeInvoiceNo(inv.invoiceDate, inv.id),
    customerName: inv.customerName || "Customer",
    customerMobile: inv.customerMobile || "",
    invoiceDate: inv.invoiceDate,
    dueDate: inv.dueDate,
    description: inv.description || "",
    amount: inv.amount,
    taxAmount: inv.taxAmount,
    totalAmount: inv.totalAmount > 0 ? inv.totalAmount : inv.amount + (inv.taxAmount || 0),
    fleetName: opts?.fleetName || "",
    forMonth: inv.forMonth || "",
    status: inv.status || "unpaid",
    note: inv.note || "",
  };
}

export function customerInvoiceHtml(d: CustomerInvoicePrintData) {
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

  add("Invoice no.", d.invoiceNo);
  add("Invoice date", shortDate(d.invoiceDate));
  if (d.dueDate) add("Due date", shortDate(d.dueDate));
  if (d.forMonth) add("Period", d.forMonth);
  if (d.fleetName) add("Vehicle / fleet", d.fleetName);
  if (d.description) add("Description", d.description);
  if (d.note) add("Note", d.note);
  add("Status", (d.status || "unpaid").toUpperCase());
  if (d.taxAmount > 0) {
    add("Subtotal", inr(d.amount));
    add("Tax / GST", inr(d.taxAmount));
  }
  add("Amount due", inr(d.totalAmount), { bold: true });

  const statusColor = d.status === "paid" ? "#0a7a3e" : d.status === "cancelled" ? "#999" : "#b45309";
  const statusLabel = d.status === "paid" ? "PAID" : d.status === "cancelled" ? "CANCELLED" : "AMOUNT DUE";

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
    ".amt{margin:18px 0 8px;text-align:center;padding:14px;background:#fff8f0;border-radius:10px}" +
    ".amt.paid{background:#f0f7f2}" +
    ".amt .lbl{font-size:12px;color:#666;text-transform:uppercase;letter-spacing:.04em}" +
    ".amt .val{font-size:28px;font-weight:700;margin-top:4px}" +
    ".foot{margin-top:20px;font-size:11px;color:#888;text-align:center;line-height:1.45}" +
    "@media print{body{background:#fff;padding:0}.sheet{box-shadow:none;max-width:none}}" +
    "</style></head><body><div class=\"sheet\"><div class=\"hdr\"><h1>" +
    escapeHtml(d.company) +
    "</h1><p>Tax invoice / bill</p></div>" +
    '<p style="margin:0 0 2px;font-size:15px;font-weight:600">Bill to</p>' +
    '<p style="margin:0 0 4px;font-size:16px;font-weight:600">' +
    escapeHtml(d.customerName) +
    "</p>" +
    (d.customerMobile
      ? '<p style="margin:0 0 12px;font-size:12px;color:#666">' +
        escapeHtml(d.customerMobile) +
        "</p>"
      : '<p style="margin:0 0 12px"></p>') +
    '<div class="amt' +
    (d.status === "paid" ? " paid" : "") +
    '"><div class="lbl" style="color:' +
    statusColor +
    '">' +
    escapeHtml(statusLabel) +
    '</div><div class="val" style="color:' +
    statusColor +
    '">' +
    escapeHtml(inr(d.totalAmount)) +
    "</div></div>" +
    "<table>" +
    rows.join("") +
    "</table>" +
    '<p class="foot">This is a computer-generated invoice from ' +
    escapeHtml(d.company) +
    ".<br/>Please pay by the due date. Thank you.</p></div>" +
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

export function printCustomerInvoice(d: CustomerInvoicePrintData) {
  const html = customerInvoiceHtml(d);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) {
    const safe = (d.customerName || "customer").replace(/\s+/g, "-").replace(/[^\w\-]+/g, "");
    downloadBlob(blob, "invoice-" + safe + "-" + d.invoiceNo + ".html");
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function invoiceWhatsAppText(d: CustomerInvoicePrintData) {
  return [
    `${d.company} — Invoice`,
    ``,
    `Invoice: ${d.invoiceNo}`,
    `Customer: ${d.customerName}`,
    d.invoiceDate ? `Date: ${shortDate(d.invoiceDate)}` : null,
    d.dueDate ? `Due: ${shortDate(d.dueDate)}` : null,
    d.description ? `For: ${d.description}` : null,
    d.forMonth ? `Period: ${d.forMonth}` : null,
    d.fleetName ? `Vehicle: ${d.fleetName}` : null,
    d.taxAmount > 0 ? `Subtotal: ${inr(d.amount)}` : null,
    d.taxAmount > 0 ? `Tax: ${inr(d.taxAmount)}` : null,
    `Amount due: ${inr(d.totalAmount)}`,
    `Status: ${(d.status || "unpaid").toUpperCase()}`,
    d.note ? `Note: ${d.note}` : null,
    ``,
    `Please pay by due date. Thank you.`,
  ]
    .filter(Boolean)
    .join("\n");
}
