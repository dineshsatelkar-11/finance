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
  const [opening, setOpening] = useState("");
  /** true = company owes driver (+); false = driver owes company (-) */
  const [openingPositive, setOpeningPositive] = useState(true);
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
    const ob = driver?.openingBalance ?? 0;
    setOpeningPositive(ob >= 0);
    setOpening(ob !== 0 ? String(Math.abs(ob)) : "");
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
      openingBalance: (parseFloat(opening) || 0) * (openingPositive ? 1 : -1),
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
        <div className="space-y-4">
          <div>
            <Label htmlFor="drv-name">Name</Label>
            <Input id="drv-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="drv-mob">Mobile</Label>
            <Input id="drv-mob" inputMode="numeric" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          </div>
          <div>
            <Label>Type</Label>
            <div className="flex gap-2">
              {(["full", "part"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`h-10 flex-1 rounded-md border text-sm font-medium ${
                    kind === k ? "border-accent bg-accent-soft text-accent" : "border-line bg-raised text-muted"
                  }`}
                >
                  {k === "full" ? "Full-time" : "Part-time"}
                </button>
              ))}
            </div>
          </div>
          {kind === "full" ? (
            <div>
              <Label htmlFor="drv-sal">Base salary (₹)</Label>
              <Input id="drv-sal" inputMode="decimal" className="tabular-nums" value={base} onChange={(e) => setBase(e.target.value)} />
            </div>
          ) : (
            <div>
              <Label htmlFor="drv-day">Daily rate (₹)</Label>
              <Input id="drv-day" inputMode="decimal" className="tabular-nums" value={daily} onChange={(e) => setDaily(e.target.value)} />
            </div>
          )}
          <div>
            <Label htmlFor="drv-open">Opening balance (₹)</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpeningPositive(true)}
                className={`h-10 shrink-0 rounded-md border px-3 text-[12px] font-medium ${
                  openingPositive
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line bg-raised text-muted"
                }`}
              >
                We owe
              </button>
              <button
                type="button"
                onClick={() => setOpeningPositive(false)}
                className={`h-10 shrink-0 rounded-md border px-3 text-[12px] font-medium ${
                  !openingPositive
                    ? "border-warn bg-warn-soft text-warn"
                    : "border-line bg-raised text-muted"
                }`}
              >
                They owe
              </button>
              <Input
                id="drv-open"
                inputMode="decimal"
                className="tabular-nums"
                placeholder="0"
                value={opening}
                onChange={(e) => setOpening(e.target.value.replace(/[^0-9.]/g, ""))}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted">
              {openingPositive
                ? "Company owes this driver (advance already with them / balance due)"
                : "Driver owes the company (recovery / overpayment)"}
            </p>
          </div>
          <div className="rounded-lg border border-line bg-accent-soft/50 p-4">
            <UpiField id="drv-upi" value={upi} onChange={setUpi} payeeName={payee} onPayeeName={setPayee} />
          </div>
          <div>
            <Label htmlFor="drv-note">Note</Label>
            <Input id="drv-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button className="w-full" onClick={save}>
            Save driver
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
