import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { defaultBankId, useFinance } from "@/lib/finance/store";
import {
  inr,
  monthISO,
  monthLabel,
  prevMonthISO,
  salarySettlement,
  todayISO,
} from "@/lib/finance/format";
import { buildSalarySlipData, salarySlipNote } from "@/lib/finance/salary-slip";
import { flushFinanceSave } from "@/lib/finance/sync";
import type { PayMode, PayoutKind } from "@/lib/finance/types";

const KINDS: { id: PayoutKind; label: string }[] = [
  { id: "advance", label: "Advance" },
  { id: "salary", label: "Salary" },
  { id: "bonus", label: "Bonus" },
  { id: "extra_route", label: "Extra work" },
  { id: "return", label: "Return" },
  { id: "fine", label: "Fine" },
];

export function PaySheet({
  open,
  onOpenChange,
  driverId,
  onDriverIdChange: _onDriverIdChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  driverId: string | null;
  onDriverIdChange?: (id: string | null) => void;
}) {
  const drivers = useFinance((s) => s.drivers);
  const attendances = useFinance((s) => s.attendances);
  const setAttendance = useFinance((s) => s.setAttendance);
  const recordPayout = useFinance((s) => s.recordPayout);
  const setPayoutStatus = useFinance((s) => s.setPayoutStatus);
  const payouts = useFinance((s) => s.payouts);
  const fleets = useFinance((s) => s.fleets);

  const [id, setId] = useState("");
  const [kind, setKind] = useState<PayoutKind>("advance");
  const [leaveDays, setLeaveDays] = useState("0");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState<PayMode>("cash");
  const [bankId, setBankId] = useState("");
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [salaryForMonth, setSalaryForMonth] = useState(prevMonthISO());
  const [bonusAmt, setBonusAmt] = useState("0");
  const [deductionAmt, setDeductionAmt] = useState("0");
  const [rentOffDays, setRentOffDays] = useState("0");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const st = useFinance.getState();
    const list = st.drivers;
    const d = list.find((x) => x.id === driverId) || list.find((x) => x.active) || list[0];
    const workMonth = prevMonthISO(monthISO());
    const att = st.attendances.find((a) => a.driverId === d?.id && a.month === workMonth);
    const leaves = att?.leaveDays ?? 0;
    setId(d?.id || "");
    setKind("advance");
    setSalaryForMonth(workMonth);
    setLeaveDays(String(leaves));
    setBonusAmt("0");
    setDeductionAmt("0");
    setRentOffDays("0");
    setAmount("");
    setDate(todayISO());
    setMode("cash");
    setBankId(defaultBankId());
    setNote("");
    setStep("form");
    setPendingId(null);
    setPosting(false);
  }, [open, driverId]);

  const driver = drivers.find((d) => d.id === id);
  const leaveN = Math.max(0, Math.floor(parseFloat(leaveDays) || 0));
  const bonusN = Math.max(0, parseFloat(bonusAmt) || 0);
  const deductionN = Math.max(0, parseFloat(deductionAmt) || 0);
  const rentOffN = Math.max(0, Math.floor(parseFloat(rentOffDays) || 0));
  const settle = driver
    ? salarySettlement({
        driver,
        leaveDays: leaveN,
        month: salaryForMonth,
        payouts,
        fleets,
        bonus: bonusN,
        deduction: deductionN,
        rentOffDays: rentOffN,
        throughDate: date, // advances only before / on slip date
      })
    : null;
  const salaryGross = settle?.gross ?? 0;
  const balanceTillToday = settle?.balance ?? 0;
  const tempoRent = settle?.rent ?? 0;
  const rentFleetName = settle?.rentFleetName ?? null;

  function salarySlipAmount(s: NonNullable<typeof settle>) {
    return Math.round((s.gross + s.bonus - s.rent - s.deduction) * 100) / 100;
  }

  function applySalarySlip() {
    if (!driver || !settle) return;
    const slip = salarySlipAmount(settle);
    setAmount(String(Math.max(0, slip)));
    const after = Math.round((balanceTillToday + slip) * 100) / 100;
    setNote(
      salarySlipNote({
        month: salaryForMonth,
        leaveDays: leaveN,
        rentOffDays: rentOffN,
        bonus: bonusN,
        deduction: deductionN,
        rent: settle.rent,
        slipAmount: slip,
        balanceBefore: balanceTillToday,
        balanceAfter: after,
      }),
    );
  }

  async function postSalarySlip() {
    if (!driver || posting) return;
    const data = buildSalarySlipData({
      driver,
      month: salaryForMonth,
      date,
      leaveDays: leaveN,
      payouts,
      fleets,
      bonus: bonusN,
      deduction: deductionN,
      rentOffDays: rentOffN,
    });
    const slip = data.slipAmount;
    if (!(slip > 0)) {
      toast.error("Salary slip amount is zero");
      return;
    }
    const already = payouts.some(
      (p) =>
        p.driverId === driver.id &&
        p.kind === "salary" &&
        p.status === "paid" &&
        String(p.note || "").includes(salaryForMonth),
    );
    if (already) {
      toast.message("Salary slip for this month already posted");
      return;
    }
    setPosting(true);
    try {
      setAttendance(driver.id, salaryForMonth, leaveN);
      const rec = recordPayout({
        driverId: driver.id,
        kind: "salary",
        amount: slip,
        date,
        mode: "cash",
        bankAccountId: bankId || defaultBankId(),
        upiVpa: "",
        note: data.note,
        status: "paid",
      });
      if (!rec.ok) {
        toast.error(rec.error);
        return;
      }
      onOpenChange(false);
      toast.success(
        data.balanceAfter >= 0
          ? `Slip ₹${Math.round(slip)} posted — company owes ₹${Math.round(data.balanceAfter)}`
          : `Slip ₹${Math.round(slip)} posted — over-advanced ₹${Math.round(Math.abs(data.balanceAfter))}`,
      );
      const save = await flushFinanceSave();
      if (!save.ok) {
        toast.error(save.error || "Posted on phone but failed to reach cloud");
      }
    } finally {
      setPosting(false);
    }
  }

  async function goConfirm() {
    if (!driver) {
      toast.error("Select a driver");
      return;
    }
    const amt = parseFloat(amount);
    if (!(amt > 0)) {
      toast.error("Enter amount");
      return;
    }
    // Extra work: unpaid at the time — record as paid balance adjustment only (no bank cash).
    // Reduces driver balance so salary settlement picks it up automatically.
    if (kind === "extra_route") {
      const rec = recordPayout({
        driverId: driver.id,
        kind: "extra_route",
        amount: amt,
        date,
        mode: "cash",
        bankAccountId: bankId || defaultBankId(),
        upiVpa: "",
        note: note || "Extra work (balance only)",
        status: "paid",
      });
      if (!rec.ok) {
        toast.error(rec.error);
        return;
      }
      onOpenChange(false);
      toast.success(`Extra work −${inr(amt)} on balance`);
      const save = await flushFinanceSave();
      if (!save.ok) {
        toast.error(save.error || "Saved on phone but failed to reach cloud");
      }
      return;
    }
    const rec = recordPayout({
      driverId: driver.id,
      kind,
      amount: amt,
      date,
      mode,
      bankAccountId: bankId || defaultBankId(),
      upiVpa: "",
      note,
      status: "pending",
    });
    if (!rec.ok) {
      toast.error(rec.error);
      return;
    }
    setPendingId(rec.id);
    setStep("confirm");
  }

  async function markPaid() {
    const id = pendingId;
    if (id) {
      setPayoutStatus(id, "paid");
    }
    // Close sheet first so UI is not stuck waiting on cloud
    setPendingId(null);
    setStep("form");
    onOpenChange(false);
    toast.success("Marked paid");
    if (id) {
      const save = await flushFinanceSave();
      if (!save.ok) {
        toast.error(save.error || "Paid on phone but failed to reach cloud");
      }
    }
  }

  function markFailed() {
    const id = pendingId;
    if (id) {
      setPayoutStatus(id, "failed");
    }
    setPendingId(null);
    setStep("form");
    onOpenChange(false);
    toast.message("Marked failed");
    if (id) void flushFinanceSave();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={
          kind === "salary" ? "Salary slip" : step === "confirm" ? "Confirm payment" : "Pay driver"
        }
      >
        {step === "form" ? (
          <div className="space-y-3">
            <div>
              <Label>Driver</Label>
              <Select value={id} onValueChange={(v) => setId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent>
                  {drivers
                    .filter((d) => d.active)
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={kind}
                onValueChange={(v) => {
                  setKind(v as PayoutKind);
                  if (v === "salary") setTimeout(applySalarySlip, 0);
                  if (v === "extra_route") setAmount("500");
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

            {kind === "salary" ? (
              <div className="rounded-lg border border-line bg-canvas/60 p-3 space-y-3">
                <div>
                  <Label>Salary for month</Label>
                  <Select
                    value={salaryForMonth}
                    onValueChange={(ym) => {
                      setSalaryForMonth(ym);
                      const att = attendances.find((a) => a.driverId === id && a.month === ym);
                      setLeaveDays(String(att?.leaveDays ?? 0));
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
                            {back === 1 ? " (typical)" : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Leave days</Label>
                    <Input
                      inputMode="numeric"
                      value={leaveDays}
                      onChange={(e) => setLeaveDays(e.target.value)}
                      onBlur={applySalarySlip}
                    />
                  </div>
                  <div>
                    <Label>Bonus ₹</Label>
                    <Input
                      inputMode="decimal"
                      value={bonusAmt}
                      onChange={(e) => setBonusAmt(e.target.value)}
                      onBlur={applySalarySlip}
                    />
                  </div>
                  <div>
                    <Label>Deduction ₹</Label>
                    <Input
                      inputMode="decimal"
                      value={deductionAmt}
                      onChange={(e) => setDeductionAmt(e.target.value)}
                      onBlur={applySalarySlip}
                    />
                  </div>
                  <div>
                    <Label>Rent off days</Label>
                    <Input
                      inputMode="numeric"
                      value={rentOffDays}
                      onChange={(e) => setRentOffDays(e.target.value)}
                      onBlur={applySalarySlip}
                    />
                  </div>
                </div>
                <div className="rounded-md border border-line p-2.5 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted">Gross</span>
                    <span className="tabular-nums">{inr(salaryGross)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Balance till date</span>
                    <span className="tabular-nums">{inr(balanceTillToday)}</span>
                  </div>
                  {tempoRent > 0 ? (
                    <div className="flex justify-between">
                      <span className="text-muted">
                        Tempo rent{rentFleetName ? ` (${rentFleetName})` : ""}
                      </span>
                      <span className="tabular-nums">−{inr(tempoRent)}</span>
                    </div>
                  ) : null}
                  {bonusN > 0 ? (
                    <div className="flex justify-between">
                      <span className="text-muted">Bonus</span>
                      <span className="tabular-nums">{inr(bonusN)}</span>
                    </div>
                  ) : null}
                  {deductionN > 0 ? (
                    <div className="flex justify-between">
                      <span className="text-muted">Deduction</span>
                      <span className="tabular-nums">−{inr(deductionN)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between border-t border-line pt-1 font-medium">
                    <span>Salary slip amount</span>
                    <span className="tabular-nums">
                      {inr(settle ? salarySlipAmount(settle) : 0)}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-muted">
                  Slip accrues to driver balance (company owes). Cash around 10th is recorded as advance.
                </p>
                <Button type="button" className="w-full" disabled={posting} onClick={postSalarySlip}>
                  {posting ? "Posting…" : "Post salary slip"}
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <Label>Amount ₹</Label>
                  <Input
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={kind === "extra_route" ? "500" : "0"}
                  />
                  {kind === "extra_route" ? (
                    <p className="mt-1 text-[11px] text-muted">
                      Unpaid extra work — reduces balance only (no bank cash). Default ₹500.
                    </p>
                  ) : null}
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                {kind !== "extra_route" ? (
                  <>
                    <div>
                      <Label>Mode</Label>
                      <Select value={mode} onValueChange={(v) => setMode(v as PayMode)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="upi">UPI</SelectItem>
                          <SelectItem value="bank">Bank</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Bank account</Label>
                      <Select value={bankId} onValueChange={setBankId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select bank" />
                        </SelectTrigger>
                        <SelectContent>
                          {useFinance.getState().banks.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : null}
                <div>
                  <Label>Note (optional)</Label>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Extra trip / night" />
                </div>
                <Button type="button" className="w-full" onClick={goConfirm}>
                  {kind === "extra_route" ? "Record extra work on balance" : "Continue"}
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-line p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted">Driver</span>
                <span className="font-medium">{driver?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Type</span>
                <span className="font-medium">{KINDS.find((k) => k.id === kind)?.label || kind}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Amount</span>
                <span className="font-medium">{inr(parseFloat(amount) || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Date</span>
                <span>{date}</span>
              </div>
              {note ? (
                <div className="flex justify-between gap-2">
                  <span className="text-muted shrink-0">Note</span>
                  <span className="text-right">{note}</span>
                </div>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" className="flex-1" onClick={markPaid}>
                Mark paid
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={markFailed}>
                Mark failed
              </Button>
            </div>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("form")}>
              Back
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
