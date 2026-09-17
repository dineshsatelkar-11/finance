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
import {
  inr,
  monthISO,
  monthLabel,
  openWhatsApp,
  prevMonthISO,
  salarySettlement,
  todayISO,
  WORKING_DAYS,
} from "@/lib/finance/format";
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
  /** Work month the salary is for (calculated last day of that month; paid next month ~10–15). */
  const [salaryForMonth, setSalaryForMonth] = useState(prevMonthISO());
  const [bonusAmt, setBonusAmt] = useState("0");
  const [deductionAmt, setDeductionAmt] = useState("0");
  const fleets = useFinance((s) => s.fleets);

  useEffect(() => {
    if (!open) return;
    const st = useFinance.getState();
    const list = st.drivers;
    const d = list.find((x) => x.id === driverId) || list.find((x) => x.active) || list[0];
    // Default: settle previous calendar month (paid this month around 10–15)
    const workMonth = prevMonthISO(monthISO());
    const att = st.attendances.find((a) => a.driverId === d?.id && a.month === workMonth);
    const leaves = att?.leaveDays ?? 0;
    setId(d?.id || "");
    setKind("advance");
    setSalaryForMonth(workMonth);
    setLeaveDays(String(leaves));
    setBonusAmt("0");
    setDeductionAmt("0");
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

  const payouts = useFinance((s) => s.payouts);
  const driver = drivers.find((d) => d.id === id);
  const leaveN = Math.max(0, Math.floor(parseFloat(leaveDays) || 0));
  const bonusN = Math.max(0, parseFloat(bonusAmt) || 0);
  const deductionN = Math.max(0, parseFloat(deductionAmt) || 0);
  const settle = driver
    ? salarySettlement({
        driver,
        leaveDays: leaveN,
        month: salaryForMonth,
        payouts,
        fleets,
        bonus: bonusN,
        deduction: deductionN,
      })
    : null;
  const salaryGross = settle?.gross ?? 0;
  const advancesThisMonth = settle?.advances ?? 0;
  const tempoRent = settle?.rent ?? 0;
  const rentFleetName = settle?.rentFleetName ?? null;
  const salaryNet = settle?.net ?? 0;
  const os = detectMobileOs();

  function applySalaryNet(d = driver, leaves = leaveN, ym = salaryForMonth, bonus = bonusN, ded = deductionN) {
    if (!d) return 0;
    const s = salarySettlement({
      driver: d,
      leaveDays: leaves,
      month: ym,
      payouts,
      fleets,
      bonus,
      deduction: ded,
    });
    setAmount(String(Math.max(0, s.net)));
    const parts = [
      `Salary ${monthLabel(ym)}`,
      s.bonus > 0 ? `bonus ${s.bonus}` : null,
      s.advances > 0 ? `adv −${s.advances}` : null,
      s.rent > 0 ? `rent −${s.rent}` : null,
      s.deduction > 0 ? `deduct −${s.deduction}` : null,
      `net ${Math.max(0, s.net)}`,
    ].filter(Boolean);
    setNote(parts.join(" · "));
    return s.net;
  }

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
                  const workM = kind === "salary" ? salaryForMonth : month;
                  const att = attendances.find((a) => a.driverId === next && a.month === workM);
                  const leaves = att?.leaveDays ?? 0;
                  setId(next);
                  setUpi(d?.upiVpa || "");
                  setPayee(d?.upiPayeeName || d?.name || "");
                  setLeaveDays(String(leaves));
                  if (kind === "salary" && d) {
                    applySalaryNet(d, leaves, salaryForMonth, bonusN, deductionN);
                  }
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
                <Select
                  value={kind}
                  onValueChange={(v) => {
                    const next = v as PayoutKind;
                    setKind(next);
                    if (next === "salary" && driver) {
                      const workM = salaryForMonth;
                      const att = attendances.find((a) => a.driverId === driver.id && a.month === workM);
                      const leaves = att?.leaveDays ?? leaveN;
                      setLeaveDays(String(leaves));
                      setBonusAmt("0");
                      setDeductionAmt("0");
                      applySalaryNet(driver, leaves, workM, 0, 0);
                    }
                  }}
                >
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
                <p className="text-[12px] text-muted">
                  Month-end settlement (same day):{" "}
                  <span className="font-medium text-ink">gross + bonus − advances − tempo rent − deduction</span>
                  . Usually paid 10–15 of next month.
                </p>
                <div>
                  <Label>Salary for month</Label>
                  <Select
                    value={salaryForMonth}
                    onValueChange={(ym) => {
                      setSalaryForMonth(ym);
                      if (!driver) return;
                      const att = attendances.find((a) => a.driverId === driver.id && a.month === ym);
                      const leaves = att?.leaveDays ?? 0;
                      setLeaveDays(String(leaves));
                      applySalaryNet(driver, leaves, ym, bonusN, deductionN);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3].map((back) => {
                        let ym = monthISO();
                        for (let i = 0; i < back; i++) ym = prevMonthISO(ym);
                        return (
                          <SelectItem key={ym} value={ym}>
                            {monthLabel(ym)}
                            {back === 1 ? " (typical — pay this month)" : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
                  <div>
                    <Label htmlFor="pay-leave">Leave days</Label>
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
                          setAttendance(driver.id, salaryForMonth, n);
                          applySalaryNet(driver, n, salaryForMonth, bonusN, deductionN);
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label>Gross salary</Label>
                    <div className="flex h-11 items-center font-medium tabular-nums text-ink">
                      {inr(salaryGross)}
                    </div>
                    <p className="text-[11px] text-muted">After leave · {monthLabel(salaryForMonth)}</p>
                  </div>
                </div>
                <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
                  <div>
                    <Label htmlFor="pay-bonus">Bonus (₹)</Label>
                    <Input
                      id="pay-bonus"
                      inputMode="decimal"
                      className="tabular-nums"
                      value={bonusAmt}
                      onChange={(e) => {
                        setBonusAmt(e.target.value);
                        const b = Math.max(0, parseFloat(e.target.value) || 0);
                        if (driver) applySalaryNet(driver, leaveN, salaryForMonth, b, deductionN);
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pay-deduct">Deduction / negligence (₹)</Label>
                    <Input
                      id="pay-deduct"
                      inputMode="decimal"
                      className="tabular-nums"
                      value={deductionAmt}
                      onChange={(e) => {
                        setDeductionAmt(e.target.value);
                        const d = Math.max(0, parseFloat(e.target.value) || 0);
                        if (driver) applySalaryNet(driver, leaveN, salaryForMonth, bonusN, d);
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5 rounded-md border border-line bg-raised/50 p-2.5 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted">Gross</span>
                    <span className="tabular-nums">{inr(salaryGross)}</span>
                  </div>
                  {bonusN > 0 ? (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted">+ Bonus</span>
                      <span className="tabular-nums text-ok">+ {inr(bonusN)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-2">
                    <span className="text-muted">− Advances ({monthLabel(salaryForMonth)})</span>
                    <span className="tabular-nums text-warn">− {inr(advancesThisMonth)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted">
                      − Tempo rent
                      {rentFleetName ? ` · ${rentFleetName}` : ""}
                      {tempoRent <= 0 ? " (none)" : ""}
                    </span>
                    <span className="tabular-nums text-warn">− {inr(tempoRent)}</span>
                  </div>
                  {tempoRent <= 0 ? (
                    <p className="text-[11px] text-muted">
                      Rent only if driver is linked to a fleet that charges rent. Others stay ₹0.
                    </p>
                  ) : null}
                  {deductionN > 0 ? (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted">− Deduction / negligence</span>
                      <span className="tabular-nums text-warn">− {inr(deductionN)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-2 border-t border-line pt-1.5 font-medium">
                    <span>Net to pay</span>
                    <span
                      className={
                        salaryNet < 0 ? "tabular-nums text-warn" : "tabular-nums text-ink"
                      }
                    >
                      {inr(salaryNet)}
                    </span>
                  </div>
                  {salaryNet < 0 ? (
                    <p className="text-[11px] text-warn">Over-advanced / over-deducted — nothing further to pay</p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!driver) return;
                    setAttendance(driver.id, salaryForMonth, leaveN);
                    applySalaryNet();
                    toast.message(
                      salaryNet < 0
                        ? "Over-advanced — amount set to 0"
                        : "Amount set to full settlement net",
                    );
                  }}
                >
                  Use net amount
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
              <div className="space-y-3 rounded-lg border border-line bg-canvas/40 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Smartphone className="size-4 text-accent" />
                  UPI for {driver?.name || "driver"}
                </div>
                <UpiField
                  value={upi}
                  onChange={setUpi}
                  payeeName={payee}
                  onPayeeNameChange={setPayee}
                />
                <label className="flex items-center gap-2 text-[12px] text-muted">
                  <input
                    type="checkbox"
                    checked={saveUpi}
                    onChange={(e) => setSaveUpi(e.target.checked)}
                    className="size-4 rounded border-line"
                  />
                  Save UPI on this driver
                </label>
                {vpa ? (
                  <p className="font-mono text-[12px] text-muted">{maskVpa(vpa)}</p>
                ) : (
                  <p className="flex items-center gap-1 text-[12px] text-warn">
                    <ShieldAlert className="size-3.5" /> Add UPI before paying
                  </p>
                )}
              </div>
            ) : null}

            <div>
              <Label htmlFor="pay-note">Note</Label>
              <Input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            <Button type="button" className="w-full" onClick={goConfirm}>
              Continue
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-line bg-canvas/60 p-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted">Driver</span>
                <span className="font-medium">{driver?.name}</span>
              </div>
              <div className="mt-1 flex justify-between gap-2">
                <span className="text-muted">Type</span>
                <Badge tone="muted">{KINDS.find((k) => k.id === kind)?.label || kind}</Badge>
              </div>
              <div className="mt-1 flex justify-between gap-2">
                <span className="text-muted">Amount</span>
                <span className="font-medium tabular-nums">{inr(parseFloat(amount) || 0)}</span>
              </div>
              {note ? (
                <p className="mt-2 text-[12px] text-muted">{note}</p>
              ) : null}
            </div>

            {mode === "upi" && vpa ? (
              <div className="flex flex-col items-center gap-3">
                <UpiQr vpa={vpa} payeeName={payee || driver?.name || ""} amount={parseFloat(amount) || 0} />
                <div className="flex flex-wrap justify-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => openApp("paytm")}>
                    Paytm
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => openApp("phonepe")}>
                    PhonePe
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => openApp("generic")}>
                    Other UPI
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void onShare()}>
                    <Share2 className="size-3.5" /> Share
                  </Button>
                </div>
                <p className="text-center text-[11px] text-muted">OS hint: {os}</p>
              </div>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" onClick={markPaid}>
                Mark paid
              </Button>
              <Button type="button" variant="outline" onClick={sharePaidWa}>
                <MessageCircle className="size-4" /> WhatsApp
              </Button>
              <Button type="button" variant="outline" onClick={markFailed}>
                Mark failed
              </Button>
              <Button type="button" variant="outline" onClick={() => setStep("form")}>
                Back
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
