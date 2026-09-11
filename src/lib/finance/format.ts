/** Shared finance formatting & small pure helpers (client-safe). */

export const WORKING_DAYS = 26;

export function monthISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
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

/** Suggested salary for the month after leave deduction. */
export function suggestedSalary(
  driver: { kind: string; baseSalary: number; dailyRate: number },
  leaveDays = 0,
  workingDays = WORKING_DAYS,
) {
  const leave = Math.max(0, Math.min(workingDays, Math.floor(leaveDays) || 0));
  const present = Math.max(0, workingDays - leave);
  if (driver.kind === "part") {
    return Math.round((driver.dailyRate || 0) * present);
  }
  if (!(driver.baseSalary > 0)) return 0;
  return Math.round((driver.baseSalary * present) / workingDays);
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
 * Running balance vs driver (opening / advances / returns / fines).
 *
 * Positive = company still owes driver; negative = over-advanced / driver owes.
 *
 * - Advance: money given early → reduces balance.
 * - Return: driver gives money back → opposite of advance (increases balance).
 * - Fine: driver owes company → reduces balance.
 * - Salary, extra_route, bonus: work pay — not in this balance.
 */
export function driverBalance(
  driver: { id: string; kind?: string; baseSalary?: number; dailyRate?: number; openingBalance?: number },
  month: string,
  payouts: { driverId: string; kind: string; amount: number; status: string; date: string }[],
  _leaveDays = 0,
) {
  const opening = Number(driver.openingBalance) || 0;
  let advances = 0;
  let fine = 0;
  let returned = 0;
  for (const p of payouts) {
    if (p.driverId !== driver.id || !p.date.startsWith(month) || p.status !== "paid") continue;
    if (p.kind === "fine") fine += p.amount;
    else if (p.kind === "return") returned += p.amount;
    else if (p.kind === "advance") advances += p.amount;
  }
  return Math.round((opening - advances + returned - fine) * 100) / 100;
}
