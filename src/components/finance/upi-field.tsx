import { useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, ClipboardPaste } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { isKnownHandle, isValidVpa, parseUpiPayload } from "@/lib/finance/upi";
import { cn } from "@/lib/utils";

export function UpiField({
  id,
  label = "UPI ID",
  value,
  onChange,
  payeeName,
  onPayeeName,
  hint,
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (v: string) => void;
  payeeName?: string;
  onPayeeName?: (v: string) => void;
  hint?: string;
}) {
  const [pasteErr, setPasteErr] = useState("");

  const parsed = useMemo(() => {
    if (!value.trim()) return null;
    return parseUpiPayload(value);
  }, [value]);

  const valid = parsed ? isValidVpa(parsed.vpa) : false;
  const known = parsed ? isKnownHandle(parsed.vpa) : false;

  async function pasteFromClipboard() {
    setPasteErr("");
    try {
      const text = await navigator.clipboard.readText();
      const p = parseUpiPayload(text);
      if (!p) {
        setPasteErr("Clipboard has no UPI ID. Copy the ID or a upi:// QR payload first.");
        return;
      }
      onChange(p.vpa);
      if (p.payeeName && onPayeeName) onPayeeName(p.payeeName);
    } catch {
      setPasteErr("Could not read clipboard. Paste into the field instead.");
    }
  }

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="name@ybl or paste upi://pay?pa=…"
          value={value}
          onChange={(e) => {
            setPasteErr("");
            onChange(e.target.value);
          }}
        />
        <Button type="button" variant="outline" size="icon" onClick={pasteFromClipboard} aria-label="Paste UPI">
          <ClipboardPaste />
        </Button>
      </div>
      {onPayeeName ? (
        <div className="mt-3">
          <Label htmlFor={`${id}-name`}>Payee name on UPI</Label>
          <Input
            id={`${id}-name`}
            placeholder="Name shown in the UPI app"
            value={payeeName || ""}
            onChange={(e) => onPayeeName(e.target.value)}
          />
        </div>
      ) : null}
      <p
        className={cn(
          "mt-2 flex items-start gap-1.5 text-[12px] leading-snug",
          value.trim() && !valid ? "text-danger" : "text-muted",
        )}
      >
        {value.trim() && !valid ? (
          <>
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
            UPI ID must look like name@bank — include the @ handle.
          </>
        ) : valid ? (
          <>
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-ok" />
            <span>
              Will pay <span className="font-medium text-ink">{parsed!.vpa}</span>
              {!known ? " · uncommon handle, double-check before paying" : ""}
            </span>
          </>
        ) : (
          hint || "Saved on this driver, all devices using this desk."
        )}
      </p>
      {pasteErr ? <p className="mt-1 text-[12px] text-danger">{pasteErr}</p> : null}
    </div>
  );
}
