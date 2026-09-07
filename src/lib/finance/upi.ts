/** Known NPCI VPA handles — used for a soft warning, not a hard block. */
const KNOWN_HANDLES = new Set([
  "ybl",
  "ibl",
  "axl",
  "okaxis",
  "okicici",
  "okhdfcbank",
  "oksbi",
  "paytm",
  "pnb",
  "sbi",
  "upi",
  "apl",
  "yesbank",
  "icici",
  "hdfcbank",
  "kotak",
  "barodampay",
  "freecharge",
  "amazonpay",
  "okbizaxis",
]);

const VPA_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;

export type ParsedUpi = {
  vpa: string;
  payeeName: string;
  amount: number | null;
};

/** Pull a VPA out of a typed ID, QR payload, or upi:// intent. */
export function parseUpiPayload(raw: string): ParsedUpi | null {
  const s = String(raw || "").trim();
  if (!s) return null;

  if (/upi:\/\//i.test(s) || /(?:^|[?&])pa=/i.test(s)) {
    try {
      const q = s.includes("?") ? s.slice(s.indexOf("?") + 1) : s;
      const params = new URLSearchParams(q.replace(/&/g, "&"));
      const pa = (params.get("pa") || params.get("PA") || "").trim();
      const pn = (params.get("pn") || params.get("PN") || "").trim();
      const am = parseFloat(params.get("am") || "");
      if (pa && pa.includes("@")) {
        return {
          vpa: normalizeVpa(pa),
          payeeName: pn,
          amount: Number.isFinite(am) && am > 0 ? am : null,
        };
      }
    } catch {
      /* fall through */
    }
    const m = s.match(/pa=([^&]+)/i);
    if (m?.[1]) {
      try {
        const pa = decodeURIComponent(m[1]).trim();
        if (pa.includes("@")) {
          return { vpa: normalizeVpa(pa), payeeName: "", amount: null };
        }
      } catch {
        /* ignore */
      }
    }
  }

  const inline = s.match(/[a-zA-Z0-9._-]{2,}@[a-zA-Z][a-zA-Z0-9]{1,63}/);
  if (inline) {
    return { vpa: normalizeVpa(inline[0]), payeeName: "", amount: null };
  }

  return null;
}

export function normalizeVpa(vpa: string) {
  return vpa.trim().replace(/\s+/g, "").toLowerCase();
}

export function isValidVpa(vpa: string) {
  return VPA_RE.test(normalizeVpa(vpa));
}

export function vpaHandle(vpa: string) {
  const n = normalizeVpa(vpa);
  const i = n.lastIndexOf("@");
  return i >= 0 ? n.slice(i + 1) : "";
}

export function isKnownHandle(vpa: string) {
  return KNOWN_HANDLES.has(vpaHandle(vpa));
}

/** Mask for lists / pre-confirm. Reveal only on the pay confirm step. */
export function maskVpa(vpa: string) {
  const n = normalizeVpa(vpa);
  const i = n.indexOf("@");
  if (i < 1) return "••••";
  const user = n.slice(0, i);
  const handle = n.slice(i);
  if (user.length <= 3) return `${user[0]}••${handle}`;
  return `${user.slice(0, 2)}•••${user.slice(-1)}${handle}`;
}

export type UpiIntentResult = {
  url: string;
  /** Paytm often rejects web-originated intents ("security error"). Prefer copy. */
  paytmUnsafe: boolean;
};

/**
 * Soft P2P intent only: pa + pn + am + cu.
 * Do NOT send tn / tr / mc / mode — those trip Paytm/PhonePe security blocks.
 */
export function buildUpiIntent(opts: {
  vpa: string;
  payeeName: string;
  amount: number;
}): UpiIntentResult | null {
  const pa = normalizeVpa(opts.vpa);
  if (!isValidVpa(pa)) return null;
  const am = Number(opts.amount);
  if (!(am > 0)) return null;
  const params = new URLSearchParams();
  params.set("pa", pa);
  params.set("pn", String(opts.payeeName || "Payee").slice(0, 50));
  params.set("am", am.toFixed(2));
  params.set("cu", "INR");
  return { url: `upi://pay?${params.toString()}`, paytmUnsafe: true };
}

export function payPacketText(opts: {
  vpa: string;
  payeeName: string;
  amount: number;
}) {
  return [
    `UPI ID: ${normalizeVpa(opts.vpa)}`,
    `Name: ${opts.payeeName}`,
    `Amount: ₹${Number(opts.amount).toFixed(2)}`,
  ].join("\n");
}

export function isLikelyMobile() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
