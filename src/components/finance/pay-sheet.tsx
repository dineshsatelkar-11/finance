import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, ShieldAlert, Smartphone } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UpiField } from "@/components/finance/upi-field";
import { defaultBankId, useFinance } from "@/lib/finance/store";
import { inr, todayISO } from "@/lib/finance/format";
import type { PayMode, PayoutKind } from "@/lib/finance/types";
import {
  buildUpiIntent,
  isLikelyMobile,
  isValidVpa,
  maskVpa,
  normalizeVpa,
  parseUpiPayload,
  payPacketText,
} from "@/lib/finance/upi";

const KINDS: { id: PayoutKind; label: string }[] = [
  { id: "salary", label: "Salary" },
  { id: "advance", label: "Advance" },
  { id: "extra_route", label: "Extra route" },
  { id: "return", label: "Return" },
  { id: "fine", label: "Fine" },
];

export function PaySheet({
  open,
  onOpenChange,
  driverId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  driverId: string | null;
}) {
  const drivers = useFinance((s) => s.drivers);
  const banks = useFinance((s) => s.banks);
  const setDriverUpi = useFinance((s) => s.setDriverUpi);
  const recordPayout = useFinance((s) => s.recordPayout);
  const setPayoutStatus = useFinance((s) => s.setPayoutStatus);

  const [id, setId] = useState("");
  const [kind, setKind] = useState<PayoutKind>("salary");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState<PayMode>("upi");
  const [bankId, setBankId] = useState("");
  const [upi, setUpi] = useState("");
  const [payee, setPayee] = useState("");
  const [saveUpi, setSaveUpi] = useState(true);
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!open) return;
    const list = useFinance.getState().drivers;
    const d = list.find((x) => x.id === driverId) || list.find((x) => x.active) || list[0];
    setId(d?.id || "");
    setKind("salary");
    setAmount(d?.kind === "full" && d.baseSalary ? String(d.baseSalary) : "");
    setDate(todayISO());
    setMode("upi");
    setBankId(defaultBankId());
    setUpi(d?.upiVpa || "");
    setPayee(d?.upiPayeeName || d?.name || "");
    setSaveUpi(true);
    setNote("");
    setStep("form");
    setPendingId(null);
    setRevealed(false);
  }, [open, driverId]);

  const driver = drivers.find((d) => d.id === id);

  const vpa = useMemo(() => {
    const p = parseUpiPayload(upi);
    return p?.vpa || (isValidVpa(upi) ? normalizeVpa(upi) : "");
  }, [upi]);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed — select the text manually.");
    }
  }

  function goConfirm() {
    if (!driver) {
      toast.error("Select a driver.");
      return;
    }
    const amt = parseFloat(amount);
    if (!(amt > 0)) {
      toast.error("Enter an amount.");
      return;
    }
    if (mode === "upi" && !isValidVpa(vpa)) {
      toast.error("Add a valid UPI ID for this driver first.");
      return;
    }
    if (mode === "upi" && saveUpi && vpa && vpa !== driver.upiVpa) {
      const r = setDriverUpi(driver.id, vpa, payee || driver.name);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
    }
    const rec = recordPayout({
      driverId: driver.id,
      kind,
      amount: amt,
      date,
      mode,
      bankAccountId: bankId,
      upiVpa: vpa,
      note,
      status: "pending",
    });
    if (!rec.ok) {
      toast.error(rec.error);
      return;
    }
    setPendingId(rec.id);
    setStep("confirm");
    setRevealed(false);
  }

  function openUpiApp() {
    if (!driver) return;
    const intent = buildUpiIntent({ vpa, payeeName: payee || driver.name, amount: parseFloat(amount) });
    if (!intent) {
      toast.error("Could not build a UPI link.");
      return;
    }
    void copy(payPacketText({ vpa, payeeName: payee || driver.name, amount: parseFloat(amount) }), "Pay details");
    if (!isLikelyMobile()) {
      toast.message("UPI apps only open on a phone. Details copied — paste in Paytm or PhonePe.");
      return;
    }
    window.location.href = intent.url;
  }

  function markPaid() {
    if (pendingId) setPayoutStatus(pendingId, "paid");
    toast.success("Payout recorded as paid.");
    onOpenChange(false);
  }

  function markFailed() {
    if (pendingId) setPayoutStatus(pendingId, "failed");
    toast.message("Left as failed. Nothing taken from the bank ledger.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={step === "form" ? "Pay a driver" : "Confirm payment"}>
        {step === "form" ? (
          <div className="space-y-4">
            <div>
              <Label>Driver</Label>
              <Select
                value={id}
                onValueChange={(next) => {
                  const d = drivers.find((x) => x.id === next);
                  setId(next);
                  setUpi(d?.upiVpa || "");
                  setPayee(d?.upiPayeeName || d?.name || "");
                  if (d?.kind === "full" && d.baseSalary) setAmount(String(d.baseSalary));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent>
                  {drivers
                    .filter((d) => d.active)
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                        {d.upiVpa ? "" : " · no UPI"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as PayoutKind)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => (
                      <SelectItem key={k.id} value={k.id}>
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="pay-amt">Amount (₹)</Label>
                <Input
                  id="pay-amt"
                  inputMode="decimal"
                  className="font-medium tabular-nums"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pay-date">Date</Label>
                <Input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
                    <SelectItem value="bank">Bank transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Paid from</Label>
              <Select value={bankId} onValueChange={setBankId}>
                <SelectTrigger>
                  <SelectValue />
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

            {mode === "upi" ? (
              <div className="rounded-lg border border-line bg-accent-soft/60 p-4">
                {driver?.upiVpa ? (
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">On file</div>
                      <div className="text-sm font-medium text-ink">{maskVpa(driver.upiVpa)}</div>
                    </div>
                    <Badge tone="ok">Saved</Badge>
                  </div>
                ) : (
                  <div className="mb-3 rounded-md border border-warn/20 bg-warn-soft px-3 py-2 text-[13px] text-warn">
                    No UPI saved for {driver?.name || "this driver"}. Add it here — it stays on the driver record.
                  </div>
                )}
                <UpiField
                  id="pay-upi"
                  value={upi}
                  onChange={setUpi}
                  payeeName={payee}
                  onPayeeName={setPayee}
                />
                <label className="mt-3 flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    className="size-4 accent-accent"
                    checked={saveUpi}
                    onChange={(e) => setSaveUpi(e.target.checked)}
                  />
                  Save this UPI ID on the driver
                </label>
              </div>
            ) : null}

            <div>
              <Label htmlFor="pay-note">Note</Label>
              <Input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            </div>

            <Button className="w-full" onClick={goConfirm}>
              Continue to confirm
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-navy px-4 py-5 text-navy-fg">
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-navy-fg/60">
                {KINDS.find((k) => k.id === kind)?.label} · {driver?.name}
              </div>
              <div className="mt-1 font-display text-4xl font-medium tabular-nums tracking-tight">
                {inr(parseFloat(amount) || 0)}
              </div>
            </div>

            {mode === "upi" ? (
              <>
                <div className="flex items-start gap-2 rounded-md border border-warn/25 bg-warn-soft px-3 py-2.5 text-[13px] leading-snug text-warn">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                  Paytm often blocks in-app UPI links with a security error. Copy the UPI ID, open Paytm, then Pay to UPI
                  ID.
                </div>
                <div className="rounded-lg border border-line bg-raised px-3 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">UPI ID</span>
                    <button
                      type="button"
                      className="text-[12px] font-medium text-accent"
                      onClick={() => setRevealed((v) => !v)}
                    >
                      {revealed ? "Hide" : "Reveal"}
                    </button>
                  </div>
                  <div className="mt-1 font-medium tabular-nums text-ink">{revealed ? vpa : maskVpa(vpa)}</div>
                  <div className="mt-0.5 text-[12px] text-muted">{payee || driver?.name}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => copy(vpa, "UPI ID")}>
                    <Copy /> Copy UPI ID
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      copy(
                        payPacketText({
                          vpa,
                          payeeName: payee || driver?.name || "",
                          amount: parseFloat(amount) || 0,
                        }),
                        "Pay details",
                      )
                    }
                  >
                    <Copy /> Copy details
                  </Button>
                </div>
                <Button variant="navy" className="w-full" onClick={openUpiApp}>
                  <Smartphone /> Open UPI app
                </Button>
                <p className="text-[12px] text-muted">
                  Payment is not marked paid until you confirm below. Opening an app never records a payout on its own.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted">
                {mode === "cash" ? "Cash payout" : "Bank transfer"} — confirm only after the money has left.
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button variant="danger" onClick={markFailed}>
                Payment failed
              </Button>
              <Button onClick={markPaid}>Mark paid</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
