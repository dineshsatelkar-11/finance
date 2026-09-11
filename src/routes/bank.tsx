import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFinance } from "@/lib/finance/store";
import { clearAllFinanceData } from "@/lib/finance/sync";
import { inr, shortDate, todayISO, uid } from "@/lib/finance/format";
import type { BankAccount } from "@/lib/finance/types";
import { UpiQr } from "@/components/finance/upi-qr";
import { isValidVpa, normalizeVpa, parseUpiPayload } from "@/lib/finance/upi";
import { ArrowLeftRight, QrCode, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/bank")({ component: BankPage });

function BankPage() {
  const month = useFinance((s) => s.month);
  const banks = useFinance((s) => s.banks);
  const payouts = useFinance((s) => s.payouts);
  const expenses = useFinance((s) => s.expenses);
  const drivers = useFinance((s) => s.drivers);
  const bankTransfers = useFinance((s) => s.bankTransfers ?? []);
  const upsertBank = useFinance((s) => s.upsertBank);
  const removeBank = useFinance((s) => s.removeBank);
  const removeBankTransfer = useFinance((s) => s.removeBankTransfer);
  const setDefaultBank = useFinance((s) => s.setDefaultBank);
  const recordBankTransfer = useFinance((s) => s.recordBankTransfer);
  const [clearing, setClearing] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [name, setName] = useState("");
  const [opening, setOpening] = useState("");
  const [asDefault, setAsDefault] = useState(false);
  const [error, setError] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [collectVpa, setCollectVpa] = useState("");
  const [collectName, setCollectName] = useState("Satelkar Logistics");
  const [collectAmt, setCollectAmt] = useState("");
  const [xferOpen, setXferOpen] = useState(false);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [xferAmt, setXferAmt] = useState("");
  const [xferDate, setXferDate] = useState(todayISO());
  const [xferNote, setXferNote] = useState("");
  const [xferError, setXferError] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("finance.collectUpi");
      if (raw) {
        const j = JSON.parse(raw) as { vpa?: string; name?: string };
        if (j.vpa) setCollectVpa(j.vpa);
        if (j.name) setCollectName(j.name);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function saveCollectUpi() {
    const p = parseUpiPayload(collectVpa);
    const vpa = p?.vpa || (isValidVpa(collectVpa) ? normalizeVpa(collectVpa) : "");
    if (!vpa) return;
    setCollectVpa(vpa);
    try {
      localStorage.setItem(
        "finance.collectUpi",
        JSON.stringify({ vpa, name: collectName.trim() || "Satelkar Logistics" }),
      );
    } catch {
      /* ignore */
    }
  }

  const paidOut = [...payouts, ...expenses].filter(
    (r) => r.status === "paid" && r.date.startsWith(month),
  );

  function openAdd() {
    setEditing(null);
    setName("");
    setOpening("0");
    setAsDefault(banks.length === 0);
    setError("");
    setOpen(true);
  }

  function openEdit(b: BankAccount) {
    setEditing(b);
    setName(b.name);
    setOpening(String(b.opening));
    setAsDefault(b.isDefault);
    setError("");
    setOpen(true);
  }

  function save() {
    const n = name.trim();
    if (!n) {
      setError("Enter an account name.");
      return;
    }
    const openBal = Math.round((Number(opening) || 0) * 100) / 100;
    const row: BankAccount = {
      id: editing?.id || uid("bank"),
      name: n,
      opening: openBal,
      isDefault: asDefault || banks.length === 0,
    };
    upsertBank(row);
    if (row.isDefault) setDefaultBank(row.id);
    setOpen(false);
  }

  const collectVpaClean = (() => {
    const p = parseUpiPayload(collectVpa);
    return p?.vpa || collectVpa;
  })();

  function openTransfer() {
    const def = banks.find((b) => b.isDefault)?.id || banks[0]?.id || "";
    const other = banks.find((b) => b.id !== def)?.id || "";
    setFromId(def);
    setToId(other);
    setXferAmt("");
    setXferDate(todayISO());
    setXferNote("");
    setXferError("");
    setXferOpen(true);
  }

  function submitTransfer() {
    const res = recordBankTransfer({
      fromBankId: fromId,
      toBankId: toId,
      amount: Number(xferAmt),
      date: xferDate || todayISO(),
      note: xferNote,
    });
    if (!res.ok) {
      setXferError(res.error);
      return;
    }
    setXferOpen(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Bank</h1>
          <p className="mt-1 text-sm text-muted">
            Opening balances plus this month’s confirmed outflows. Pending UPI is not deducted.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={openTransfer}
            disabled={banks.length < 2}
          >
            <ArrowLeftRight className="size-4" /> Transfer
          </Button>
          <Button type="button" variant="outline" onClick={() => setQrOpen(true)}>
            <QrCode className="size-4" /> Collect QR
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button type="button" onClick={openAdd}>
                Add bank
              </Button>
            </DialogTrigger>
            <DialogContent title={editing ? "Edit bank" : "Add bank"}>
              <div className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <Label htmlFor="bank-name">Account name</Label>
                  <Input
                    id="bank-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. SBI Current · Pune"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bank-opening">Opening balance (₹)</Label>
                  <Input
                    id="bank-opening"
                    type="number"
                    inputMode="decimal"
                    value={opening}
                    onChange={(e) => setOpening(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={asDefault}
                    onChange={(e) => setAsDefault(e.target.checked)}
                    className="size-4 rounded border-line"
                  />
                  Set as default account
                </label>
                {error ? <p className="text-sm text-danger">{error}</p> : null}
                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={save}>
                    {editing ? "Save" : "Add account"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent title="Collect money — show QR">
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Show this QR to a driver or customer. They open Paytm / GPay → Scan & Pay → money comes
              to your UPI.
            </p>
            <div>
              <Label>Your UPI ID</Label>
              <Input
                value={collectVpa}
                onChange={(e) => setCollectVpa(e.target.value)}
                onBlur={saveCollectUpi}
                placeholder="yourname@paytm"
              />
            </div>
            <div>
              <Label>Name on UPI</Label>
              <Input
                value={collectName}
                onChange={(e) => setCollectName(e.target.value)}
                onBlur={saveCollectUpi}
                placeholder="Satelkar Logistics"
              />
            </div>
            <div>
              <Label>Amount (₹) — optional</Label>
              <Input
                inputMode="decimal"
                className="tabular-nums"
                value={collectAmt}
                onChange={(e) => setCollectAmt(e.target.value)}
                placeholder="Leave blank for open amount"
              />
            </div>
            <UpiQr
              vpa={collectVpaClean}
              payeeName={collectName || "Satelkar Logistics"}
              amount={parseFloat(collectAmt) || undefined}
              size={240}
              caption="Hold this screen steady while they scan."
            />
            <Button type="button" className="w-full" onClick={saveCollectUpi}>
              Save UPI for next time
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={xferOpen} onOpenChange={setXferOpen}>
        <DialogContent title="Bank transfer">
          <div className="space-y-4 text-left">
            <p className="text-sm text-muted">
              Move money between your own accounts. Opening balances update immediately.
            </p>
            <div className="space-y-1.5">
              <Label>From account</Label>
              <Select value={fromId} onValueChange={setFromId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>To account</Label>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="xfer-amt">Amount (₹)</Label>
              <Input
                id="xfer-amt"
                type="number"
                inputMode="decimal"
                className="tabular-nums"
                value={xferAmt}
                onChange={(e) => setXferAmt(e.target.value)}
                placeholder="0"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="xfer-date">Date</Label>
              <Input
                id="xfer-date"
                type="date"
                value={xferDate}
                onChange={(e) => setXferDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="xfer-note">Note (optional)</Label>
              <Input
                id="xfer-note"
                value={xferNote}
                onChange={(e) => setXferNote(e.target.value)}
                placeholder="e.g. Cash deposit to HDFC"
              />
            </div>
            {xferError ? <p className="text-sm text-danger">{xferError}</p> : null}
            <Button type="button" className="w-full" onClick={submitTransfer}>
              Transfer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3 sm:grid-cols-2">
        {banks.map((b) => {
          const out = paidOut
            .filter((r) => r.bankAccountId === b.id)
            .reduce((s, r) => s + r.amount, 0);
          return (
            <Card key={b.id}>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{b.name}</CardTitle>
                <div className="flex items-center gap-2">
                  {b.isDefault ? <Badge tone="accent">Default</Badge> : null}
                  <Button type="button" variant="outline" size="sm" onClick={() => openEdit(b)}>
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!window.confirm(`Delete bank "${b.name}"?`)) return;
                      const r = removeBank(b.id);
                      if (!r.ok) {
                        toast.error(r.error);
                        return;
                      }
                      toast.message("Bank deleted");
                    }}
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </Button>
                </div>
              </div>
              <CardHint>Opening {inr(b.opening)}</CardHint>
              <div className="mt-4 font-display text-3xl font-medium tabular-nums tracking-tight">
                {inr(b.opening - out)}
              </div>
              <p className="mt-1 text-[12px] text-muted">Out this month {inr(out)}</p>
              {!b.isDefault ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={() => setDefaultBank(b.id)}
                >
                  Make default
                </Button>
              ) : null}
            </Card>
          );
        })}
      </div>

      {banks.length === 0 ? (
        <Card>
          <CardTitle>No bank accounts</CardTitle>
          <CardHint>Add HDFC, SBI, cash, or any account you use for payouts and expenses.</CardHint>
          <Button type="button" className="mt-4" onClick={openAdd}>
            Add bank
          </Button>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Ledger</CardTitle>
        <CardHint>Confirmed outflows and internal transfers.</CardHint>
        <ul className="mt-4 divide-y divide-line">
          {[
            ...paidOut.map((r) => ({
              id: r.id,
              date: r.date,
              sort: r.date,
              kind: "out" as const,
              label:
                "kind" in r
                  ? `${drivers.find((d) => d.id === r.driverId)?.name || "Driver"} · ${String(r.kind).replace("_", " ")}`
                  : `${r.category} · ${r.vendor}`,
              sub: r.mode.toUpperCase(),
              amount: r.amount,
            })),
            ...bankTransfers.map((x) => {
              const fromName = banks.find((b) => b.id === x.fromBankId)?.name || "From";
              const toName = banks.find((b) => b.id === x.toBankId)?.name || "To";
              return {
                id: x.id,
                date: x.date,
                sort: x.date,
                kind: "xfer" as const,
                label: `Transfer · ${fromName} → ${toName}`,
                sub: x.note || "Internal",
                amount: x.amount,
              };
            }),
          ]
            .sort((a, b) => b.sort.localeCompare(a.sort))
            .slice(0, 25)
            .map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <div className="font-medium capitalize">{r.label}</div>
                  <div className="text-[12px] text-muted">
                    {shortDate(r.date)} · {r.sub}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={
                      r.kind === "xfer" ? "tabular-nums text-muted" : "tabular-nums text-danger"
                    }
                  >
                    {r.kind === "xfer" ? "\u2194" : "\u2212"}
                    {inr(r.amount)}
                  </div>
                  {r.kind === "xfer" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!window.confirm("Delete this transfer? Balances will be reversed.")) return;
                        const res = removeBankTransfer(r.id);
                        if (!res.ok) {
                          toast.error(res.error);
                          return;
                        }
                        toast.message("Transfer deleted");
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
        </ul>
      </Card>

      <Button
        variant="outline"
        disabled={clearing}
        onClick={async () => {
          if (
            !window.confirm(
              "Clear ALL data from the app and Neon database? This cannot be undone.",
            )
          ) {
            return;
          }
          setClearing(true);
          const res = await clearAllFinanceData();
          setClearing(false);
          if (!res.ok) {
            window.alert(res.error || "Clear failed");
            return;
          }
          window.alert("All data cleared.");
        }}
      >
        {clearing ? "Clearing\u2026" : "Clear all data"}
      </Button>
    </div>
  );
}
