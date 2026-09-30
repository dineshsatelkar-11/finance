/** Shared finance formatting & small pure helpers (client-safe). */

export const WORKING_DAYS = 26;

export function monthISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Previous calendar month as YYYY-MM (e.g. for salary calculated last month, paid this month). */
export function prevMonthISO(ym?: string) {
  const base = ym && /^\d{4}-\d{2}$/.test(ym) ? ym : monthISO();
  const [y, m] = base.split("-").map(Number);
  const d = new Date(y!, (m! - 1) - 1, 1);
  return monthISO(d);
}

export function todayISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function inr(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.round(v));
}

export function inrCompact(n: number) {
  const abs = Math.abs(n);
  if (abs >= 100000) {
    return `${n < 0 ? "−" : ""}₹${(abs / 100000).toFixed(abs >= 1000000 ? 1 : 2)}L`;
  }
  return inr(n);
}

export function shortDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function daysInMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
}

/** Normalize Indian mobile to digits; returns 91XXXXXXXXXX when possible. */
export function waPhone(mobile: string) {
  const d = String(mobile || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10) return `91${d}`;
  if (d.length === 12 && d.startsWith("91")) return d;
  if (d.length === 11 && d.startsWith("0")) return `91${d.slice(1)}`;
  return d;
}

/** Open WhatsApp chat with prefilled message. Empty mobile → wa.me share picker. */
export function whatsappUrl(mobile: string, text: string) {
  const phone = waPhone(mobile);
  const q = encodeURIComponent(text);
  return phone ? `https://wa.me/${phone}?text=${q}` : `https://wa.me/?text=${q}`;
}

export function openWhatsApp(mobile: string, text: string) {
  const url = whatsappUrl(mobile, text);
  if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
  return url;
}

/**
 * Gross month salary after leave deduction.
 * Days in month = calendar length (28/29/30/31). Official leave default 0;
 * only marked leave days reduce present days.
 */
export function suggestedSalary(
  driver: { kind: string; baseSalary: number; dailyRate: number },
  leaveDays = 0,
  /** YYYY-MM → use that month's calendar day count (28–31). Number = explicit day base. */
  monthOrDays: string | number = monthISO(),
) {
  let workingDays: number;
  if (typeof monthOrDays === "string" && /^\d{4}-\d{2}$/.test(monthOrDays)) {
    workingDays = daysInMonth(monthOrDays);
  } else if (typeof monthOrDays === "number" && Number.isFinite(monthOrDays) && monthOrDays > 0) {
    workingDays = Math.max(1, Math.floor(monthOrDays));
  } else {
    // Never fall back to fixed 26 — use current calendar month length.
    workingDays = daysInMonth(monthISO());
  }
  const leave = Math.max(0, Math.min(workingDays, Math.floor(leaveDays) || 0));
  const present = Math.max(0, workingDays - leave);
  if (driver.kind === "part") {
    return Math.round((driver.dailyRate || 0) * present);
  }
  if (!(driver.baseSalary > 0)) return 0;
  // e.g. base 14000, Sep 30 days, leave 22 → present 8 → round(14000 * 8 / 30) = 3733
  return Math.round((driver.baseSalary * present) / workingDays);
}

/**
 * Paid advances for a driver through the end of a salary month (or through today
 * when settling the current month). Includes money already paid early as "advance"
 * (salary paid ahead is usually recorded as advance).
 */
export function monthAdvances(
  driverId: string,
  month: string,
  payouts: { driverId: string; kind: string; amount: number; status: string; date: string }[],
  /** Optional YYYY-MM-DD — defaults to last day of `month` or today, whichever is earlier when month is current. */
  throughDate?: string,
) {
  const dim = daysInMonth(month);
  const lastOfMonth = `${month}-${String(dim).padStart(2, "0")}`;
  const today = todayISO();
  // Cap at end of salary month; if still inside that month, also don't go past today.
  let through = throughDate && /^\d{4}-\d{2}-\d{2}$/.test(throughDate) ? throughDate : lastOfMonth;
  if (through > lastOfMonth) through = lastOfMonth;
  if (month === today.slice(0, 7) && through > today) through = today;

  let sum = 0;
  for (const p of payouts) {
    if (p.driverId !== driverId || p.status !== "paid") continue;
    // Early salary cash is recorded as advance; only those reduce the settlement.
    if (p.kind !== "advance") continue;
    const d = String(p.date || "").slice(0, 10);
    if (!d || d > through) continue;
    sum += Number(p.amount) || 0;
  }
  return Math.round(sum * 100) / 100;
}

/** Rent after breakdown waiver. */
export function effectiveRent(
  monthlyRent: number,
  breakdownDays: number,
  waiverAmount = 0,
  daysInMonth = 30,
) {
  if (waiverAmount > 0) return Math.max(0, Math.round(monthlyRent - waiverAmount));
  const days = Math.max(0, Math.min(daysInMonth, Math.floor(breakdownDays) || 0));
  if (days <= 0 || !(monthlyRent > 0)) return monthlyRent;
  const perDay = monthlyRent / daysInMonth;
  return Math.max(0, Math.round(monthlyRent - perDay * days));
}

/**
 * Tempo monthly rent for a driver — only if linked fleet charges rent.
 * Not all drivers rent a tempo (company vehicle / no fleet → ₹0).
 * Off days (maintenance / breakdown) pro-rate rent down.
 */
export function driverTempoRent(
  driver: { fleetId?: string | null },
  fleets: { id: string; monthlyRent?: number; chargesRent?: boolean; name?: string }[],
  opts?: {
    breakdownDays?: number;
    waiverAmount?: number;
    daysInMonth?: number;
  },
): {
  fullRent: number;
  amount: number;
  offDays: number;
  fleetName: string | null;
} {
  if (!driver.fleetId) return { fullRent: 0, amount: 0, offDays: 0, fleetName: null };
  const fleet = fleets.find((f) => f.id === driver.fleetId);
  if (!fleet) return { fullRent: 0, amount: 0, offDays: 0, fleetName: null };
  const fullRent = Number(fleet.monthlyRent) || 0;
  if (fleet.chargesRent === false || !(fullRent > 0)) {
    return { fullRent: 0, amount: 0, offDays: 0, fleetName: fleet.name || null };
  }
  const dim = Math.max(28, Math.min(31, Math.floor(opts?.daysInMonth || 30)));
  const off = Math.max(0, Math.min(dim, Math.floor(opts?.breakdownDays || 0)));
  const waiver = Math.max(0, Number(opts?.waiverAmount) || 0);
  const amount = effectiveRent(fullRent, off, waiver, dim);
  return {
    fullRent: Math.round(fullRent * 100) / 100,
    amount: Math.round(amount * 100) / 100,
    offDays: off,
    fleetName: fleet.name || null,
  };
}

export type SalarySettlementInput = {
  driver: { id: string; kind: string; baseSalary: number; dailyRate: number; fleetId?: string | null };
  leaveDays: number;
  month: string;
  payouts: { driverId: string; kind: string; amount: number; status: string; date: string }[];
  fleets: { id: string; monthlyRent?: number; chargesRent?: boolean; name?: string }[];
  bonus?: number;
  deduction?: number;
  /** Tempo off days (maintenance) — rent pro-rata for those days. */
  rentOffDays?: number;
};

export type SalarySettlement = {
  gross: number;
  bonus: number;
  advances: number;
  rentFull: number;
  rent: number;
  rentOffDays: number;
  rentFleetName: string | null;
  deduction: number;
  net: number;
};

/** Full month-end settlement (same day calc). */
export function salarySettlement(input: SalarySettlementInput): SalarySettlement {
  const gross = suggestedSalary(input.driver, input.leaveDays, input.month);
  const advances = monthAdvances(input.driver.id, input.month, input.payouts);
  const dim = daysInMonth(input.month);
  const rentInfo = driverTempoRent(input.driver, input.fleets, {
    breakdownDays: input.rentOffDays || 0,
    daysInMonth: dim > 0 ? dim : 30,
  });
  const bonus = Math.max(0, Math.round((Number(input.bonus) || 0) * 100) / 100);
  const deduction = Math.max(0, Math.round((Number(input.deduction) || 0) * 100) / 100);
  const rent = rentInfo.amount;
  const net = Math.round((gross + bonus - advances - rent - deduction) * 100) / 100;
  return {
    gross,
    bonus,
    advances,
    rentFull: rentInfo.fullRent,
    rent,
    rentOffDays: rentInfo.offDays,
    rentFleetName: rentInfo.fleetName,
    deduction,
    net,
  };
}

/**
 * Net salary for a work month: gross − advances (no bonus/rent/deduction).
 * Prefer salarySettlement when bonus / tempo rent / negligence apply.
 */
export function netSalaryPayable(
  driver: { id: string; kind: string; baseSalary: number; dailyRate: number; fleetId?: string | null },
  leaveDays: number,
  month: string,
  payouts: { driverId: string; kind: string; amount: number; status: string; date: string }[],
  fleets: { id: string; monthlyRent?: number; chargesRent?: boolean; name?: string }[] = [],
  bonus = 0,
  deduction = 0,
) {
  return salarySettlement({
    driver,
    leaveDays,
    month,
    payouts,
    fleets,
    bonus,
    deduction,
  }).net;
}

/**
 * Running balance vs driver.
 *
 * Positive = company still owes driver; negative = driver owes company.
 * All-time (not month-scoped). Month arg kept for call-site compatibility.
 *
 * Month-end: post salary (kind salary, paid) → adds net slip to balance (we may owe them).
 * Around the 10th: cash paid is usually recorded as advance → reduces balance.
 *
 * - Opening
 * - Advance: cash given → reduces balance
 * - Return: driver pays us back → increases balance
 * - Fine: reduces balance
 * - Salary: month-end slip amount → increases balance (accrued, not bank transfer itself)
 * - Extra route / bonus: paid work → not in balance (same as before)
 */
export function driverBalance(
  driver: { id: string; kind?: string; baseSalary?: number; dailyRate?: number; openingBalance?: number },
  _month: string,
  payouts: { driverId: string; kind: string; amount: number; status: string; date: string }[],
  _leaveDays = 0,
) {
  const opening = Number(driver.openingBalance) || 0;
  let advances = 0;
  let fine = 0;
  let returned = 0;
  let salaryAccrued = 0;
  for (const p of payouts) {
    if (p.driverId !== driver.id || p.status !== "paid") continue;
    if (p.kind === "fine") fine += p.amount;
    else if (p.kind === "return") returned += p.amount;
    else if (p.kind === "advance") advances += p.amount;
    else if (p.kind === "salary") salaryAccrued += p.amount;
  }
  return Math.round((opening - advances + returned - fine + salaryAccrued) * 100) / 100;
}
