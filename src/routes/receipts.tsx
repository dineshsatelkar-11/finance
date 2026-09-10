import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { MessageCircle, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { defaultBankId, useFinance } from "@/lib/finance/store";
import { inr, monthLabel, openWhatsApp, shortDate, todayISO, uid } from "@/lib/finance/format";
import type { PayMode } from "@/lib/finance/types";

export const Route = createFileRoute("/receipts")({ component: ReceiptsPage });

function ReceiptsPage() {
  const month = useFinance((s) => s.month);
  const receipts = useFinance((s) => s.receipts);
  const customers = useFinance((s) => s.customers);
  const fleets = useFinance((s) => s.fleets);
  const recordReceipt = useFinance((s) => s.recordReceipt);
  const updateReceipt = useFinance((s) => s.updateReceipt);
  const removeReceipt = useFinance((s) => s.removeReceipt);
  const upsertCustomer = useFinance((s) => s.upsertCustomer);
  const removeCustomer = useFinance((s) => s.removeCustomer);

  const [customerId, setCustomerId] = useState(customers[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState<PayMode>("upi");
  const [fleetId, setFleetId] = useState("none");
  const [note, setNote] = useState("");
  const [lastId, setLastId] = useState<string | null>(null);

  const rows = useMemo(
    () => receipts.filter((r) => r.date.startsWith(month)),
    [receipts, month],
  );
  const total = rows.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0);
  const customer = customers.find((c) => c.id === customerId);
  const last = receipts.find((r) => r.id === lastId);

  function save() {
    const r = recordReceipt({
      customerId,
      amount: parseFloat(amount),
      date,
      mode,
      bankAccountId: defaultBankId(),
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
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Receipts</h1>
        <p className="mt-1 text-sm text-muted">
          Customer payments to you. This month collected {inr(total)}.
        </p>
      </div>

      {last ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-ok/30 bg-ok-soft/40 p-4">
          <div>
            <div className="text-sm font-medium text-ok">Last receipt · {inr(last.amount)}</div>
            <p className="text-[13px] text-muted">
              {last.customerName} · {shortDate(last.date)} · {last.mode.toUpperCase()}
            </p>
          </div>
          <Button variant="outline" onClick={() => shareWa(last)}>
            <MessageCircle className="size-4" /> WhatsApp
          </Button>
        </Card>
      ) : null}

      <Card>
        <h2 className="font-display text-lg font-medium">Record collection</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.mobile ? ` · ${c.mobile}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="rc-amt">Amount (₹)</Label>
            <Input
              id="rc-amt"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="rc-date">Date</Label>
            <Input id="rc-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as PayMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fleet (optional)</Label>
            <Select value={fleetId} onValueChange={setFleetId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">General / not tagged</SelectItem>
                {fleets
                  .filter((f) => f.active)
                  .map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="rc-note">Note</Label>
            <Input id="rc-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={save}>Save receipt</Button>
          <Button
            variant="outline"
            onClick={() => {
              const name = window.prompt("Customer name?");
              if (!name?.trim()) return;
              const mobile = window.prompt("Mobile (for WhatsApp) — optional") || "";
              const id = uid("cus");
              upsertCustomer({ id, name: name.trim(), mobile: mobile.trim(), note: "" });
              setCustomerId(id);
              toast.success("Customer added");
            }}
          >
            Add customer
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        {rows.map((r) => {
          const fleet = fleets.find((f) => f.id === r.fleetId);
          const c = customers.find((x) => x.id === r.customerId);
          return (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.customerName}</span>
                    <Badge tone="ok">{r.mode.toUpperCase()}</Badge>
                    {fleet ? <Badge tone="accent">{fleet.name}</Badge> : null}
                  </div>
                  <p className="mt-1 text-[12px] text-muted">
                    {shortDate(r.date)}
                    {r.note ? ` · ${r.note}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium tabular-nums text-ok">{inr(r.amount)}</span>
                  <Button size="sm" variant="outline" onClick={() => shareWa(r)} title="WhatsApp">
                    <MessageCircle className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const raw = window.prompt("New amount (₹)", String(r.amount));
                    if (raw == null) return;
                    const amt = parseFloat(raw);
                    if (!(amt > 0)) {
                      toast.error("Invalid amount");
                      return;
                    }
                    const note = window.prompt("Note", r.note || "") ?? r.note;
                    updateReceipt(r.id, { amount: amt, note: note || "" });
                    toast.success("Receipt updated");
                  }}
                >
                  <Pencil className="size-3.5" /> Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!window.confirm("Delete this receipt?")) return;
                    removeReceipt(r.id);
                    toast.message("Receipt deleted");
                  }}
                >
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              </div>
            </Card>
          );
        })}
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No receipts in {monthLabel(month)} yet.</p>
        ) : null}
      </div>
    </div>
  );
}
