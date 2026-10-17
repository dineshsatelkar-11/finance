import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle2, MessageCircle, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { defaultBankId, useFinance } from "@/lib/finance/store";
import { inr, monthISO, openWhatsApp, shortDate, todayISO, uid } from "@/lib/finance/format";
import { buildCustomerInvoiceData, invoiceWhatsAppText, makeInvoiceNo, printCustomerInvoice } from "@/lib/finance/customer-invoice";
import type { Invoice, PayMode } from "@/lib/finance/types";
import { flushFinanceSave, rememberDeletedId } from "@/lib/finance/sync";

export const Route = createFileRoute("/invoices")({ component: InvoicesPage });

function InvoicesPage() {
  const invoices = useFinance((s) => ((s as any).invoices as Invoice[] | undefined) ?? []);
  const customers = useFinance((s) => s.customers);
  const fleets = useFinance((s) => s.fleets);
  const banks = useFinance((s) => s.banks);
  const upsertCustomer = useFinance((s) => s.upsertCustomer);
  const recordReceipt = useFinance((s) => s.recordReceipt);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unpaid" | "paid">("all");
  const [payOpen, setPayOpen] = useState<Invoice | null>(null);
  const [payMode, setPayMode] = useState<PayMode>("upi");
  const [payBank, setPayBank] = useState("");
  const [payDate, setPayDate] = useState(todayISO());
  const [payNote, setPayNote] = useState("");
  const [form, setForm] = useState({
    customerId: "", customerName: "", customerMobile: "",
    invoiceDate: todayISO(), dueDate: todayISO(), description: "",
    amount: "", taxAmount: "0", fleetId: "", forMonth: monthISO(), note: "",
  });

  useEffect(() => {
    const st = useFinance.getState() as any;
    if (!Array.isArray(st.invoices)) useFinance.setState({ invoices: [] } as any);
  }, []);

  const setInvoices = (next: Invoice[] | ((p: Invoice[]) => Invoice[])) => {
    const st = useFinance.getState() as any;
    const prev: Invoice[] = Array.isArray(st.invoices) ? st.invoices : [];
    useFinance.setState({ invoices: typeof next === "function" ? next(prev) : next } as any);
  };

  const filtered = useMemo(() => {
    let list = [...invoices];
    if (filter === "unpaid") list = list.filter((i) => i.status === "unpaid");
    if (filter === "paid") list = list.filter((i) => i.status === "paid");
    return list.sort((a, b) => (b.invoiceDate || "").localeCompare(a.invoiceDate || ""));
  }, [invoices, filter]);

  const unpaidTotal = useMemo(
    () => invoices.filter((i) => i.status === "unpaid").reduce((s, i) => s + (i.totalAmount || i.amount || 0), 0),
    [invoices],
  );

  function openNew() {
    setEditingId(null);
    setForm({
      customerId: "", customerName: "", customerMobile: "",
      invoiceDate: todayISO(), dueDate: todayISO(), description: "",
      amount: "", taxAmount: "0", fleetId: "", forMonth: monthISO(), note: "",
    });
    setShowForm(true);
  }

  function openEdit(inv: Invoice) {
    setEditingId(inv.id);
    setForm({
      customerId: inv.customerId || "", customerName: inv.customerName || "",
      customerMobile: inv.customerMobile || "", invoiceDate: inv.invoiceDate || todayISO(),
      dueDate: inv.dueDate || todayISO(), description: inv.description || "",
      amount: String(inv.amount ?? ""), taxAmount: String(inv.taxAmount ?? 0),
      fleetId: inv.fleetId || "", forMonth: inv.forMonth || monthISO(), note: inv.note || "",
    });
    setShowForm(true);
  }

  async function saveInvoice() {
    const amount = Math.round((Number(form.amount) || 0) * 100) / 100;
    const taxAmount = Math.round((Number(form.taxAmount) || 0) * 100) / 100;
    if (!(amount > 0)) return toast.error("Enter amount");
    let customerId = form.customerId;
    let customerName = form.customerName.trim();
    if (!customerId && customerName) {
      customerId = uid("cu");
      upsertCustomer({ id: customerId, name: customerName, mobile: form.customerMobile.trim(), note: "" });
    }
    if (!customerId) return toast.error("Select or enter customer");
    const id = editingId || uid("inv");
    const prev = invoices.find((x) => x.id === id);
    const inv: Invoice = {
      id,
      invoiceNo: makeInvoiceNo(form.invoiceDate, id),
      customerId,
      customerName: customerName || customers.find((c) => c.id === customerId)?.name || "Customer",
      customerMobile: form.customerMobile.trim(),
      invoiceDate: form.invoiceDate || todayISO(),
      dueDate: form.dueDate || form.invoiceDate || todayISO(),
      description: form.description.trim(),
      amount, taxAmount, totalAmount: amount + taxAmount,
      fleetId: form.fleetId || null, forMonth: form.forMonth || null,
      status: prev?.status || "unpaid",
      paidDate: prev?.paidDate ?? null, paidMode: prev?.paidMode ?? null,
      paidBankAccountId: prev?.paidBankAccountId ?? null, receiptId: prev?.receiptId ?? null,
      note: form.note.trim(),
      createdAt: prev?.createdAt || new Date().toISOString(),
    };
    if (editingId) setInvoices((list) => list.map((x) => (x.id === id ? inv : x)));
    else setInvoices((list) => [inv, ...list]);
    setShowForm(false);
    toast.success(editingId ? "Invoice updated" : "Invoice created");
    try { await flushFinanceSave(); } catch { /* cloud optional until db-repo wired */ }
  }

  async function removeInvoice(id: string) {
    if (!confirm("Delete this invoice?")) return;
    setInvoices((list) => list.filter((x) => x.id !== id));
    try { rememberDeletedId(id); await flushFinanceSave(); } catch { /* */ }
    toast.success("Deleted");
  }

  async function confirmPay() {
    if (!payOpen || !payBank) return toast.error("Select bank");
    const inv = payOpen;
    const amount = inv.totalAmount > 0 ? inv.totalAmount : inv.amount;
    const r = recordReceipt({
      customerId: inv.customerId, amount, date: payDate, mode: payMode,
      bankAccountId: payBank, fleetId: inv.fleetId,
      note: payNote || `Payment for ${inv.invoiceNo}` + (inv.description ? ` — ${inv.description}` : ""),
    });
    if (!r.ok) return toast.error(r.error);
    setInvoices((list) =>
      list.map((x) =>
        x.id === inv.id
          ? { ...x, status: "paid", paidDate: payDate, paidMode: payMode, paidBankAccountId: payBank, receiptId: r.id }
          : x,
      ),
    );
    setPayOpen(null);
    toast.success("Marked paid — receipt created");
    try { await flushFinanceSave(); } catch { /* */ }
  }

  function doPrint(inv: Invoice) {
    printCustomerInvoice(buildCustomerInvoiceData(inv, { fleetName: fleets.find((f) => f.id === inv.fleetId)?.name }));
  }
  function doWhatsApp(inv: Invoice) {
    openWhatsApp(inv.customerMobile || "", invoiceWhatsAppText(buildCustomerInvoiceData(inv, { fleetName: fleets.find((f) => f.id === inv.fleetId)?.name })));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-medium tracking-tight">Invoices</h1>
          <p className="text-[13px] text-muted">Customer billing before payment. Unpaid: {inr(unpaidTotal)}</p>
        </div>
        <Button type="button" onClick={openNew} className="gap-1.5"><Plus className="size-4" /> New invoice</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["all", "unpaid", "paid"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={"rounded-full border px-3 py-1 text-[12px] font-medium capitalize " + (filter === f ? "border-accent bg-accent-soft text-accent" : "border-line bg-raised text-muted")}>
            {f}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted">No invoices yet. Create one for a customer before payment is received.</Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((inv) => (
            <Card key={inv.id} className="p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{inv.customerName}</span>
                    <span className={"rounded-full px-2 py-0.5 text-[11px] font-medium uppercase " + (inv.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800")}>{inv.status}</span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-muted">{inv.invoiceNo} · {shortDate(inv.invoiceDate)}{inv.dueDate ? ` · due ${shortDate(inv.dueDate)}` : ""}</p>
                  {inv.description ? <p className="mt-1 text-[13px] text-ink">{inv.description}</p> : null}
                  <p className="mt-1 text-base font-semibold text-ink">{inr(inv.totalAmount || inv.amount)}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => doPrint(inv)}><Printer className="size-3.5" /></Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => doWhatsApp(inv)}><MessageCircle className="size-3.5" /></Button>
                  {inv.status === "unpaid" ? (
                    <Button type="button" size="sm" className="gap-1" onClick={() => { setPayOpen(inv); setPayBank(defaultBankId() || banks[0]?.id || ""); setPayDate(todayISO()); setPayNote(""); setPayMode("upi"); }}>
                      <CheckCircle2 className="size-3.5" /> Mark paid
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" size="sm" onClick={() => openEdit(inv)}><Pencil className="size-3.5" /></Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void removeInvoice(inv.id)}><Trash2 className="size-3.5" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {showForm ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-navy/40 sm:items-center sm:p-4">
          <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-panel p-4 sm:rounded-2xl">
            <h2 className="mb-3 font-display text-lg font-medium">{editingId ? "Edit invoice" : "New invoice"}</h2>
            <div className="space-y-3">
              <div>
                <Label>Customer</Label>
                <Select value={form.customerId || "__new"} onValueChange={(v) => {
                  if (v === "__new") return setForm((f) => ({ ...f, customerId: "" }));
                  const c = customers.find((x) => x.id === v);
                  setForm((f) => ({ ...f, customerId: v, customerName: c?.name || "", customerMobile: c?.mobile || "" }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent className="z-[100]">
                    <SelectItem value="__new">New customer…</SelectItem>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {!form.customerId ? (
                <>
                  <div><Label>Customer name</Label><Input value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} /></div>
                  <div><Label>Mobile (WhatsApp)</Label><Input value={form.customerMobile} onChange={(e) => setForm((f) => ({ ...f, customerMobile: e.target.value }))} /></div>
                </>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Invoice date</Label><Input type="date" value={form.invoiceDate} onChange={(e) => setForm((f) => ({ ...f, invoiceDate: e.target.value }))} /></div>
                <div><Label>Due date</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></div>
              </div>
              <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Transport / trip / period" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Amount</Label><Input inputMode="decimal" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></div>
                <div><Label>Tax / GST</Label><Input inputMode="decimal" value={form.taxAmount} onChange={(e) => setForm((f) => ({ ...f, taxAmount: e.target.value }))} /></div>
              </div>
              <div>
                <Label>Vehicle / fleet</Label>
                <Select value={form.fleetId || "__none"} onValueChange={(v) => setForm((f) => ({ ...f, fleetId: v === "__none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent className="z-[100]">
                    <SelectItem value="__none">None</SelectItem>
                    {fleets.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>For month</Label><Input type="month" value={form.forMonth} onChange={(e) => setForm((f) => ({ ...f, forMonth: e.target.value }))} /></div>
              <div><Label>Note</Label><Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} /></div>
              <div className="flex gap-2 pt-2">
                <Button type="button" className="flex-1" onClick={() => void saveInvoice()}>Save invoice</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {payOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-navy/40 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-2xl border border-line bg-panel p-4 sm:rounded-2xl">
            <h2 className="mb-1 font-display text-lg font-medium">Mark paid</h2>
            <p className="mb-3 text-[13px] text-muted">{payOpen.customerName} · {inr(payOpen.totalAmount || payOpen.amount)}</p>
            <div className="space-y-3">
              <div><Label>Payment date</Label><Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></div>
              <div>
                <Label>Mode</Label>
                <Select value={payMode} onValueChange={(v) => setPayMode(v as PayMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[100]">
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Received in bank</Label>
                <Select value={payBank} onValueChange={setPayBank}>
                  <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                  <SelectContent className="z-[100]">
                    {banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Note</Label><Input value={payNote} onChange={(e) => setPayNote(e.target.value)} /></div>
              <div className="flex gap-2 pt-1">
                <Button type="button" className="flex-1" onClick={() => void confirmPay()}>Confirm paid</Button>
                <Button type="button" variant="outline" onClick={() => setPayOpen(null)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
