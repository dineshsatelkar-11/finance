export function inr(n: number) {
  const abs = Math.abs(n);
  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: abs >= 100 ? 0 : 2,
  }).format(abs);
  return n < 0 ? `−${formatted}` : formatted;
}

export function inrCompact(n: number) {
  const abs = Math.abs(n);
  if (abs >= 100000) {
    return `${n < 0 ? "−" : ""}₹${(abs / 100000).toFixed(abs >= 1000000 ? 1 : 2)}L`;
  }
  return inr(n);
}

export function todayISO() {
  const d = new Date();
  const z = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function monthISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export function shortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase();
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


/** Default working days in a month for pro-rata salary. */
export const WORKING_DAYS = 30;

/** Full-time: base × (working − leave) / working. Part-time: daily × days present. */
export function suggestedSalary(
  driver: { kind: string; baseSalary: number; dailyRate: number },
  leaveDays: number,
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
