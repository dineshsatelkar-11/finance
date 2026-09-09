import { useMemo } from "react";
import { upiPayUri, upiQrImageSrc, isValidVpa, normalizeVpa } from "@/lib/finance/upi";
import { inr } from "@/lib/finance/format";
import { cn } from "@/lib/utils";

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

  if (!uri || !isValidVpa(vpa)) {
    return (
      <div className="rounded-lg border border-line bg-raised px-3 py-6 text-center text-sm text-muted">
        Add a valid UPI ID to show QR.
      </div>
    );
  }

  const src = upiQrImageSrc(uri, size);

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="rounded-xl border border-line bg-white p-3 shadow-[var(--shadow-lift)]">
        <img
          src={src}
          alt={`UPI QR for ${normalizeVpa(vpa)}`}
          width={size}
          height={size}
          className="block h-auto max-w-full"
          loading="eager"
        />
      </div>
      <div className="text-center">
        <div className="text-sm font-medium text-ink">{payeeName || "Payee"}</div>
        <div className="text-[12px] tabular-nums text-muted">{normalizeVpa(vpa)}</div>
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
