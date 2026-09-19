import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { inr, openWhatsApp, shortDate, todayISO, uid } from "@/lib/finance/format";
import type { PayMode } from "@/lib/finance/types";

export const Route = createFileRoute("/receipts")({ component: ReceiptsPage });

function ReceiptsPage() {
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

  // Month filter is dashboard-only — receipts list shows full history
  const rows = useMemo(() => receipts, [receipts]);
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
    openWhatsApp(c?.phone, text);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-medium tracking-tight">Receipts</h1>
        <p className="text-[13px] text-muted">
          Customer payments to you. Total collected {inr(total)}.
        </p>
      </div>

      <Card className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
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
