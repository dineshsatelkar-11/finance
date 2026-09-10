import { useMemo, useState } from "react";
import { upiPayUri, isValidVpa, normalizeVpa } from "@/lib/finance/upi";
import { qrSvgDataUrl } from "@/lib/finance/qr-svg";
import { inr } from "@/lib/finance/format";
import { cn } from "@/lib/utils";

function fallbackUrls(uri: string, size: number) {
  const q = encodeURIComponent(uri);
  return [
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&ecc=M&margin=8&data=${q}`,
    `https://quickchart.io/qr?text=${q}&size=${size}&margin=2`,
  ];
}

export function UpiQr({
  vpa,
  payeeName,
  amount,
  className,
  size = 260,
  caption,
}: {
  vpa: string;
  payeeName: string;
  amount?: number;
  className?: string;
  size?: number;
  caption?: string;
}) {
  const uri = useMemo(
    () =>
      upiPayUri({
        vpa,
        payeeName,
        amount: amount && amount > 0 ? amount : undefined,
      }),
    [vpa, payeeName, amount],
  );

  const offline = useMemo(() => (uri ? qrSvgDataUrl(uri, size) : ""), [uri, size]);
  const cdn = useMemo(() => (uri ? fallbackUrls(uri, size) : []), [uri, size]);
  const [srcIndex, setSrcIndex] = useState(0);
  const sources = offline ? [offline, ...cdn] : cdn;
  const src = sources[Math.min(srcIndex, Math.max(0, sources.length - 1))] || "";

  if (!uri || !isValidVpa(vpa)) {
    return (
      <div className="rounded-lg border border-line bg-raised px-3 py-6 text-center text-sm text-muted">
        Add a valid UPI ID to show QR.
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="rounded-xl border border-line bg-white p-3 shadow-[var(--shadow-lift)]">
        {src ? (
          <img
            src={src}
            alt={`UPI QR for ${normalizeVpa(vpa)}`}
            width={size}
            height={size}
            className="block h-auto max-w-full"
            loading="eager"
            onError={() => setSrcIndex((i) => i + 1)}
          />
        ) : (
          <div
            className="flex items-center justify-center text-center text-[12px] text-muted"
            style={{ width: size, height: size }}
          >
            QR unavailable — use Copy UPI ID
          </div>
        )}
      </div>
      <div className="text-center">
        <div className="text-sm font-medium text-ink">{payeeName || "Payee"}</div>
        <div className="select-all text-[13px] font-medium tabular-nums text-ink">{normalizeVpa(vpa)}</div>
        {amount && amount > 0 ? (
          <div className="mt-0.5 font-display text-lg font-medium tabular-nums text-ink">{inr(amount)}</div>
        ) : (
          <div className="mt-0.5 text-[12px] text-muted">Amount open — payer enters in app</div>
        )}
        {caption ? <p className="mt-1 max-w-[16rem] text-[11px] leading-snug text-muted">{caption}</p> : null}
      </div>
    </div>
  );
}
