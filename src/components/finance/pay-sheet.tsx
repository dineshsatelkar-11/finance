import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Share2, ShieldAlert, Smartphone } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UpiField } from "@/components/finance/upi-field";
import { UpiQr } from "@/components/finance/upi-qr";
import { defaultBankId, useFinance } from "@/lib/finance/store";
import { inr, openWhatsApp, suggestedSalary, todayISO, WORKING_DAYS } from "@/lib/finance/format";
import type { PayMode, PayoutKind } from "@/lib/finance/types";
import {
  detectMobileOs,
  isLikelyMobile,
  isValidVpa,
  maskVpa,
  normalizeVpa,
  openUpiAppLink,
  parseUpiPayload,
  sharePayDetails,
  type UpiAppId,
} from "@/lib/finance/upi";

const KINDS: { id: PayoutKind; label: string }[] = [
  { id: "advance", label: "Advance" },
  { id: "salary", label: "Salary" },
  { id: "bonus", label: "Bonus" },
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
  const month = useFinance((s) => s.month);
  const attendances = useFinance((s) => s.attendances);
  const setAttendance = useFinance((s) => s.setAttendance);
  const banks = useFinance((s) => s.banks);
  const setDriverUpi = useFinance((s) => s.setDriverUpi);
  const recordPayout = useFinance((s) => s.recordPayout);
  const setPayoutStatus = useFinance((s) => s.setPayoutStatus);

  const [id, setId] = useState("");
  const [kind, setKind] = useState<PayoutKind>("advance");
  const [leaveDays, setLeaveDays] = useState("0");
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

  useEffect(() => {
    if (!open) return;
    const st = useFinance.getState();
    const list = st.drivers;
    const d = list.find((x) => x.id === driverId) || list.find((x) => x.active) || list[0];
    const att = st.attendances.find((a) => a.driverId === d?.id && a.month === st.month);
    const leaves = att?.leaveDays ?? 0;
    setId(d?.id || "");
    setKind("advance");
    setLeaveDays(String(leaves));
    setAmount("");
    setDate(todayISO());
    setMode("upi");
    setBankId(defaultBankId());
    setUpi(d?.upiVpa || "");
    setPayee(d?.upiPayeeName || d?.name || "");
    setSaveUpi(true);
    setNote(leaves > 0 ? `Leave ${leaves} day(s) · pro-rata` : "");
    setStep("form");
    setPendingId(null);
  }, [open, driverId]);

  const driver = drivers.find((d) => d.id === id);
  const leaveN = Math.max(0, Math.floor(parseFloat(leaveDays) || 0));
  const salaryHint = driver ? suggestedSalary(driver, leaveN) : 0;
  const os = detectMobileOs();

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
    const hasAmount = Number.isFinite(amt) && amt > 0;
    if (!hasAmount && mode !== "upi") {
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
    if (hasAmount) {
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
    } else {
      setPendingId(null);
    }
    setStep("confirm");
  }

  function openApp(app: UpiAppId) {
    if (!driver) return;
    const amt = parseFloat(amount) || 0;
    const r = openUpiAppLink(app, {
      vpa,
      payeeName: payee || driver.name,
      amount: amt > 0 ? amt : undefined,
    });
    void copy(r.copied, "Pay details");
    if (!isLikelyMobile()) {
      toast.message("Open on a phone. Details copied — paste in Paytm or PhonePe.");
      return;
    }
    toast.message(
      app === "paytm"
        ? "Opening Paytm…"
        : app === "phonepe"
          ? "Opening PhonePe…"
          : "Opening UPI app…",
    );
  }

  async function onShare() {
    if (!driver) return;
    const amt = parseFloat(amount) || 0;
    const res = await sharePayDetails({
      vpa,
      payeeName: payee || driver.name,
      amount: amt > 0 ? amt : undefined,
    });
    if (res === "shared") toast.success("Shared");
    else if (res === "copied") toast.success("Pay details copied");
    else toast.error("Share failed — use Copy UPI ID");
  }

  function markPaid() {
    if (pendingId) {
      setPayoutStatus(pendingId, "paid");
      toast.success("Payout recorded as paid.");
      onOpenChange(false);
      return;
    }
    if (!driver) return;
    const amt = parseFloat(amount);
    if (!(amt > 0)) {
      toast.error("Enter the amount that was paid, then mark paid.");
      return;
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
      status: "paid",
    });
    if (!rec.ok) {
      toast.error(rec.error);
      return;
    }
    setPendingId(rec.id);
    toast.success("Payout recorded as paid.");
    onOpenChange(false);
  }

  function sharePaidWa() {
    if (!driver) return;
    const kindLabel = KINDS.find((k) => k.id === kind)?.label || kind;
    const text = [
      `Satelkar's Logistics — payment`,
      ``,
      `Driver: ${driver.name}`,
      `Type: ${kindLabel}`,
      `Amount: ${inr(parseFloat(amount) || 0)}`,
      `Mode: ${mode.toUpperCase()}`,
      ``,
      `Payment confirmed.`,
    ].join("\n");
    openWhatsApp(driver.mobile || "", text);
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
                  const att = attendances.find((a) => a.driverId === next && a.month === month);
                  const leaves = att?.leaveDays ?? 0;
                  setId(next);
                  setUpi(d?.upiVpa || "");
                  setPayee(d?.upiPayeeName || d?.name || "");
                  setLeaveDays(String(leaves));
                  if (kind === "salary" && d) setAmount(String(suggestedSalary(d, leaves)));
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

            <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
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
                <Label htmlFor="pay-amt">Amount (₹){mode === "upi" ? " · optional for QR" : ""}</Label>
                <Input
                  id="pay-amt"
                  inputMode="decimal"
                  className="font-medium tabular-nums"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>

            {kind === "salary" ? (
              <div className="rounded-lg border border-line bg-canvas/60 p-3 space-y-3">
                <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
                  <div>
                    <Label htmlFor="pay-leave">Leave days (this month)</Label>
                    <Input
                      id="pay-leave"
                      inputMode="numeric"
                      className="tabular-nums"
                      value={leaveDays}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLeaveDays(v);
                        const n = Math.max(0, Math.floor(parseFloat(v) || 0));
                        if (driver) {
                          setAmount(String(suggestedSalary(driver, n)));
                          setAttendance(driver.id, month, n);
                          setNote(n > 0 ? `Leave ${n} day(s) · pro-rata on ${WORKING_DAYS} days` : "");
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label>Suggested salary</Label>
                    <div className="flex h-11 items-center font-medium tabular-nums text-ink">{inr(salaryHint)}</div>
                    <p className="text-[11px] text-muted">Settle at month end — not in running balance</p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!driver) return;
                    setAmount(String(salaryHint));
                    setAttendance(driver.id, month, leaveN);
                    toast.message("Amount set from leave days");
                  }}
                >
                  Use suggested amount
                </Button>
              </div>
            ) : null}

            <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
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
                    No UPI saved for {driver?.name || "this driver"}. Add it here.
                  </div>
                )}
                <UpiField id="pay-upi" value={upi} onChange={setUpi} payeeName={payee} onPayeeName={setPayee} />
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
                {(() => {
                  const a = parseFloat(amount);
                  return Number.isFinite(a) && a > 0 ? inr(a) : "Open amount";
                })()}
              </div>
            </div>

            {mode === "upi" ? (
              <>
                <div className="rounded-xl border border-accent/30 bg-accent-soft/40 px-3 py-4">
                  <div className="mb-2 text-center text-[11px] font-medium uppercase tracking-[0.14em] text-accent">
                    Scan QR (amount open — enter in app)
                  </div>
                  <UpiQr
                    vpa={vpa}
                    payeeName={payee || driver?.name || "Driver"}
                    size={240}
                    caption="QR has no fixed amount. After scan, type the amount in the UPI app."
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" onClick={() => openApp("paytm")}>
                    Paytm
                  </Button>
                  <Button type="button" variant="outline" onClick={() => openApp("phonepe")}>
                    PhonePe
                  </Button>
                  <Button type="button" variant="outline" onClick={() => openApp("gpay")}>
                    GPay
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void onShare()}>
                    <Share2 className="size-4" /> Share
                  </Button>
                </div>
                <p className="text-[11px] text-muted">
                  {os === "ios"
                    ? "iPhone: if app buttons fail, copy UPI ID."
                    : os === "android"
                      ? "Android: opens the selected app when installed."
                      : "On desktop, details are copied — paste in a UPI app on phone."}
                </p>
                <div className="flex items-start gap-2 rounded-md border border-warn/25 bg-warn-soft px-3 py-2.5 text-[13px] leading-snug text-warn">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                  Payment is not marked paid until you confirm below.
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={() => void copy(vpa, "UPI ID")}>
                  <Smartphone className="size-4" /> Copy UPI ID
                </Button>
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
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                markPaid();
                sharePaidWa();
              }}
            >
              <MessageCircle className="size-4" /> Mark paid + WhatsApp
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
