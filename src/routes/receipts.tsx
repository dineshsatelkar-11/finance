import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { defaultBankId, useFinance } from "@/lib/finance/store";
import { inr, openWhatsApp, shortDate, todayISO, uid } from "@/lib/finance/format";
import type { Customer, PayMode } from "@/lib/finance/types";

export const Route = createFileRoute("/receipts")({ component: ReceiptsPage });

function ReceiptsPage() {
  const receipts = useFinance((s) => s.receipts);
  const customers = useFinance((s) => s.customers);
  const fleets = useFinance((s) => s.fleets);
  const banks = useFinance((s) => s.banks);
  const recordReceipt = useFinance((s) => s.recordReceipt);
  const removeReceipt = useFinance((s) => s.removeReceipt);
  const upsertCustomer = useFinance((s) => s.upsertCustomer);
  const removeCustomer = useFinance((s) => s.removeCustomer);

  const [customerId, setCustomerId] = useState(customers[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState<PayMode>("upi");
  const [bankAccountId, setBankAccountId] = useState("");
  const [fleetId, setFleetId] = useState("none");
  const [note, setNote] = useState("");
  const [lastId, setLastId] = useState<string | null>(null);

  const [showCustomerForm, setShowCustomerForm] = useState(customers.length === 0);
  const [custName, setCustName] = useState("");
  const [custMobile, setCustMobile] = useState("");
  const [custNote, setCustNote] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const rows = useMemo(() => receipts, [receipts]);
  const total = rows.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0);
  const last = receipts.find((r) => r.id === lastId);

  function resetCustomerForm() {
    setCustName("");
    setCustMobile("");
    setCustNote("");
    setEditingCustomer(null);
  }

  function openEditCustomer(c: Customer) {
    setEditingCustomer(c);
    setCustName(c.name);
    setCustMobile(c.mobile || "");
    setCustNote(c.note || "");
    setShowCustomerForm(true);
  }

  function saveCustomer() {
    const name = custName.trim();
    if (!name) {
      toast.error("Customer name is required");
      return;
    }
    const id = editingCustomer?.id || uid("cust");
    upsertCustomer({
      id,
      name,
      mobile: custMobile.trim(),
      note: custNote.trim(),
    });
    setCustomerId(id);
    toast.success(editingCustomer ? "Customer updated" : "Customer added");
    resetCustomerForm();
    setShowCustomerForm(false);
  }

  function save() {
    if (!customerId) {
      toast.error("Add or select a customer first");
      setShowCustomerForm(true);
      return;
    }
    const r = recordReceipt({
      customerId,
      amount: parseFloat(amount),
      date,
      mode,
      bankAccountId: bankAccountId || defaultBankId() || banks[0]?.id || "",
      fleetId: fleetId === "none" ? null : fleetId,
      note,
    });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setLastId(r.id);
    toast.success("Receipt saved — send WhatsApp if needed");
    setAmount("");
    setNote("");
  }

  function shareWa(r: (typeof receipts)[0]) {
    const c = customers.find((x) => x.id === r.customerId);
    const text = [
      `Satelkar's Logistics — payment received`,
      ``,
      `Customer: ${r.customerName}`,
      `Amount: ${inr(r.amount)}`,
      `Date: ${shortDate(r.date)}`,
      `Mode: ${r.mode.toUpperCase()}`,
      r.note ? `Note: ${r.note}` : null,
      ``,
      `Thank you.`,
    ]
      .filter(Boolean)
      .join("\n");
    openWhatsApp(c?.mobile || "", text);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-medium tracking-tight">Receipts</h1>
          <p className="text-[13px] text-muted">
            Customer payments to you. Total collected {inr(total)}.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            resetCustomerForm();
            setShowCustomerForm(true);
          }}
        >
          <Plus className="size-4" /> Add customer
        </Button>
      </div>

      {showCustomerForm ? (
        <Card className="space-y-3 border-primary/30 p-4">
          <div className="text-sm font-medium">
            {editingCustomer ? "Edit customer" : "New customer"}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Name *</Label>
              <Input
                value={custName}
                onChange={(e) => setCustName(e.target.value)}
                placeholder="Customer name"
                autoFocus
              />
            </div>
            <div>
              <Label>Mobile (optional)</Label>
              <Input
                value={custMobile}
                onChange={(e) => setCustMobile(e.target.value)}
                placeholder="For WhatsApp"
                inputMode="tel"
              />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input value={custNote} onChange={(e) => setCustNote(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveCustomer}>
              {editingCustomer ? "Save changes" : "Save customer"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                resetCustomerForm();
                setShowCustomerForm(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      {customers.length > 0 ? (
        <Card className="space-y-2 p-3">
          <div className="text-[12px] font-medium text-muted">Customers</div>
          <div className="space-y-1">
            {customers.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2.5 py-1.5"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setCustomerId(c.id)}
                >
                  <div className="truncate text-sm font-medium">{c.name}</div>
                  {c.mobile ? (
                    <div className="truncate text-[11px] text-muted">{c.mobile}</div>
                  ) : null}
                </button>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEditCustomer(c)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    onClick={() => {
                      if (!confirm(`Delete customer ${c.name}?`)) return;
                      removeCustomer(c.id);
                      if (customerId === c.id) setCustomerId("");
                      toast.success("Customer deleted");
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : !showCustomerForm ? (
        <p className="text-sm text-muted">
          No customers yet. Tap <span className="font-medium">Add customer</span> first.
        </p>
      ) : null}

      <Card className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Amount</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as PayMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Received in bank</Label>
            <Select
              value={bankAccountId || defaultBankId() || banks[0]?.id || undefined}
              onValueChange={setBankAccountId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Which account received money?" />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                {banks.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                    {b.isDefault ? " · default" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fleet (optional)</Label>
            <Select value={fleetId} onValueChange={setFleetId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                <SelectItem value="none">None</SelectItem>
                {fleets.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <Button onClick={save}>
          <Plus className="size-4" /> Save receipt
        </Button>
        {last ? (
          <Button variant="outline" size="sm" onClick={() => shareWa(last)}>
            WhatsApp last receipt
          </Button>
        ) : null}
      </Card>

      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No receipts yet.</p>
        ) : (
          rows
            .slice()
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .map((r) => (
              <Card key={r.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="font-medium">{r.customerName}</div>
                  <div className="text-[12px] text-muted">
                    {shortDate(r.date)} · {r.mode.toUpperCase()}
                    {(() => {
                      const bank = banks.find((b) => b.id === r.bankAccountId);
                      return bank ? ` · ${bank.name}` : "";
                    })()}
                    {r.note ? ` · ${r.note}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-medium tabular-nums text-success">{inr(r.amount)}</div>
                  <div className="mt-1 flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => shareWa(r)}>
                      WA
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      onClick={() => {
                        if (confirm("Delete receipt?")) removeReceipt(r.id);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
        )}
      </div>
    </div>
  );
}
