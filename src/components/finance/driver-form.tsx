import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UpiField } from "@/components/finance/upi-field";
import { useFinance } from "@/lib/finance/store";
import { uid } from "@/lib/finance/format";
import type { Driver, DriverKind } from "@/lib/finance/types";
import { isValidVpa, parseUpiPayload } from "@/lib/finance/upi";

export function DriverForm({
  open,
  onOpenChange,
  driver,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  driver: Driver | null;
}) {
  const upsert = useFinance((s) => s.upsertDriver);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [kind, setKind] = useState<DriverKind>("full");
  const [base, setBase] = useState("");
  const [daily, setDaily] = useState("");
  const [upi, setUpi] = useState("");
  const [payee, setPayee] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(driver?.name || "");
    setMobile(driver?.mobile || "");
    setKind(driver?.kind || "full");
    setBase(driver?.baseSalary ? String(driver.baseSalary) : "");
    setDaily(driver?.dailyRate ? String(driver.dailyRate) : "");
    setUpi(driver?.upiVpa || "");
    setPayee(driver?.upiPayeeName || driver?.name || "");
    setNote(driver?.note || "");
  }, [open, driver]);

  function save() {
    const n = name.trim();
    if (!n) {
      toast.error("Name is required.");
      return;
    }
    let vpa = "";
    if (upi.trim()) {
      const p = parseUpiPayload(upi);
      if (!p || !isValidVpa(p.vpa)) {
        toast.error("UPI ID must include @ (example: bharat@ybl), or paste a QR payload.");
        return;
      }
      vpa = p.vpa;
    }
    const row: Driver = {
      id: driver?.id || uid("drv"),
      name: n,
      mobile: mobile.trim(),
      kind,
      baseSalary: kind === "full" ? parseFloat(base) || 0 : 0,
      dailyRate: kind === "part" ? parseFloat(daily) || 0 : 0,
      active: driver?.active ?? true,
      upiVpa: vpa,
      upiPayeeName: (payee || n).trim(),
      upiUpdatedAt: vpa ? new Date().toISOString() : null,
      fleetId: driver?.fleetId ?? null,
      note: note.trim(),
    };
    upsert(row);
    toast.success(vpa ? `${n} saved with UPI` : `${n} saved`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={driver ? "Edit driver" : "Add driver"}>
        <div className="grid gap-4 text-left">
          <div className="grid gap-1.5">
            <Label htmlFor="drv-name" className="mb-0 text-left">
              Name
            </Label>
            <Input
              id="drv-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-left"
              autoComplete="name"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="drv-mob" className="mb-0 text-left">
              Mobile
            </Label>
            <Input
              id="drv-mob"
              inputMode="numeric"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="text-left"
              autoComplete="tel"
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="mb-0 text-left">Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["full", "part"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`h-11 rounded-md border text-sm font-medium transition-colors ${
                    kind === k
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line bg-raised text-muted hover:bg-accent-soft/60"
                  }`}
                >
                  {k === "full" ? "Full-time" : "Part-time"}
                </button>
              ))}
            </div>
          </div>

          {kind === "full" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="drv-sal" className="mb-0 text-left">
                Base salary (₹)
              </Label>
              <Input
                id="drv-sal"
                inputMode="decimal"
                className="text-left tabular-nums"
                value={base}
                onChange={(e) => setBase(e.target.value)}
              />
            </div>
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor="drv-day" className="mb-0 text-left">
                Daily rate (₹)
              </Label>
              <Input
                id="drv-day"
                inputMode="decimal"
                className="text-left tabular-nums"
                value={daily}
                onChange={(e) => setDaily(e.target.value)}
              />
            </div>
          )}

          <div className="rounded-lg border border-line bg-accent-soft/40 p-3 text-left">
            <UpiField id="drv-upi" value={upi} onChange={setUpi} payeeName={payee} onPayeeName={setPayee} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="drv-note" className="mb-0 text-left">
              Note
            </Label>
            <Input
              id="drv-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="text-left"
            />
          </div>

          <Button className="mt-1 w-full" onClick={save}>
            Save driver
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
