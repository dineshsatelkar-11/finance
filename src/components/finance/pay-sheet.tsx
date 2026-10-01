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
} from "@/lib/finance/format";
import {
  buildSalarySlipData,
  downloadSalarySlipPdf,
  printSalarySlip,
  shareSalarySlipWhatsApp,
} from "@/lib/finance/salary-slip";
import { flushFinanceSave } from "@/lib/finance/sync";
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
  const [salaryForMonth, setSalaryForMonth] = useState(prevMonthISO());
  const [bonusAmt, setBonusAmt] = useState("0");
  const [deductionAmt, setDeductionAmt] = useState("0");
  const [rentOffDays, setRentOffDays] = useState("0");
  const [posting, setPosting] = useState(false);
  const fleets = useFinance((s) => s.fleets);

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
    setMode("upi");
    setBankId(defaultBankId());
    setUpi(d?.upiVpa || "");
    setPayee(d?.upiPayeeName || d?.name || "");
    setSaveUpi(true);
    setNote(leaves > 0 ? `Leave ${leaves} day(s) · pro-rata` : "");
    setStep("form");
    setPendingId(null);
    setPosting(false);
  }, [open, driverId]);

  const payouts = useFinance((s) => s.payouts);
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
      })
    : null;
  const salaryGross = settle?.gross ?? 0;
  const advancesThisMonth = settle?.advances ?? 0;
  const balanceTillToday = (settle as { balance?: number } | null)?.balance ?? 0;
  const tempoRent = settle?.rent ?? 0;
  const rentFull = settle?.rentFull ?? 0;
  const rentFleetName = settle?.rentFleetName ?? null;
  const salaryNet = settle?.net ?? 0;
  const os = detectMobileOs();

  function salarySlipAmount(s: NonNullable<typeof settle>) {
    return Math.round((s.gross + s.bonus - s.rent - s.deduction) * 100) / 100;
  }

  function applySalarySlip(
    d = driver,
    leaves = leaveN,
    ym = salaryForMonth,
    bonus = bonusN,
    ded = deductionN,
    offDays = rentOffN,
  ) {
    if (!d) return 0;
    const s = salarySettlement({
      driver: d,
      leaveDays: leaves,
      month: ym,
      payouts,
      fleets,
      bonus,
      deduction: ded,
      rentOffDays: offDays,
    });
    const slip = salarySlipAmount(s);
    setAmount(String(Math.max(0, slip)));
    const bal = s.balance ?? 0;
    const after = Math.round((bal + slip) * 100) / 100;
    const parts = [
      `Salary slip ${ym}`,
      `leave ${leaves}`,
      offDays > 0 ? `rentOff ${offDays}` : null,
      s.bonus > 0 ? `bonus ${s.bonus}` : null,
      s.rent > 0 ? `rent −${s.rent}` : null,
      s.deduction > 0 ? `deduct ${s.deduction}` : null,
      `slip ${slip}`,
      `after bal ${after}`,
    ].filter(Boolean);
    setNote(parts.join(" · "));
    return slip;
  }

  function currentSlipData() {
    if (!driver) return null;
    return buildSalarySlipData({
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
  }

  async function postSalarySlip(opts?: { pdf?: boolean; wa?: boolean }) {
    if (!driver) {
      toast.error("Select a driver.");
      return;
    }
    if (posting) return;
    const data = currentSlipData();
    if (!data) return;
    const slip = data.slipAmount;
    if (!(slip > 0)) {
      toast.error("Salary slip amount is zero (check leave / base salary).");
      return;
    }
    const already = payouts.some(
      (p) =>
        p.driverId === driver.id &&
        p.kind === "salary" &&
        p.status === "paid" &&
        (String(p.note || "").includes(`Salary slip ${salaryForMonth}`) ||
          String(p.note || "").includes(salaryForMonth)),
    );
    if (already) {
      toast.error(
        `Salary slip for ${monthLabel(salaryForMonth)} already posted. Delete the extra slip from transactions if it was a duplicate.`,
      );
      return;
    }
    setPosting(true);
    try {
      const after = data.balanceAfter;
      const noteText =
        note && note.includes(salaryForMonth)
          ? note
          : [
              `Salary slip ${salaryForMonth}`,
              `leave ${leaveN}`,
              rentOffN > 0 ? `rentOff ${rentOffN}` : null,
              bonusN > 0 ? `bonus ${bonusN}` : null,
              deductionN > 0 ? `deduct ${deductionN}` : null,
              `slip ${slip}`,
              `after bal ${after}`,
            ]
              .filter(Boolean)
              .join(" · ");
      const rec = recordPayout({
        driverId: driver.id,
        kind: "salary",
        amount: slip,
        date,
        mode: "cash",
        bankAccountId: bankId || defaultBankId(),
        upiVpa: "",
        note: noteText,
        status: "paid",
      });
      if (!rec.ok) {
        toast.error(rec.error);
        return;
      }
      setAttendance(driver.id, salaryForMonth, leaveN);
      const flush = await flushFinanceSave();
      if (!flush.ok) {
        toast.error(flush.error || "Slip saved on phone but cloud save failed");
      }
      if (opts?.pdf) {
        downloadSalarySlipPdf(data);
        printSalarySlip(data);
      }
      if (opts?.wa) {
        shareSalarySlipWhatsApp(data);
      }
      toast.success(
        after >= 0
          ? `Salary slip ₹${Math.round(slip)} posted — balance now company owes ₹${Math.round(after)}`
          : `Salary slip ₹${Math.round(slip)} posted — still over-advanced ₹${Math.round(Math.abs(after))}`,
      );
      onOpenChange(false);
    } finally {
      setPosting(false);
    }
  }

  function postSalarySlipAndWa() {
    void postSalarySlip({ wa: true, pdf: true });
  }

  function shareSalarySlipPdfOnly() {
    const data = currentSlipData();
    if (!data || !(data.slipAmount > 0)) {
      toast.error("Salary slip amount is zero.");
      return;
    }
    downloadSalarySlipPdf(data);
    printSalarySlip(data);
    toast.message("Salary slip PDF ready — use print/share");
  }

  function shareSalarySlipWaOnly() {
    const data = currentSlipData();
    if (!data || !(data.slipAmount > 0)) {
      toast.error("Salary slip amount is zero.");
      return;
    }
    shareSalarySlipWhatsApp(data);
  }

  // --- non-salary post path kept below (truncated marker for size) ---
  return null;
}
