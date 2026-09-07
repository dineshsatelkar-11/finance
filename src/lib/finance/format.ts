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
