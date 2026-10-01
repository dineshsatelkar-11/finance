import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UpiField } from "@/components/finance/upi-field";
import { useFinance } from "@/lib/finance/store";
import { inr, uid } from "@/lib/finance/format";
import { flushFinanceSave } from "@/lib/finance/sync";
import type { Driver, DriverKind } from "@/lib/finance/types";
import { isValidVpa, parseUpiPayload } from "@/lib/finance/upi";

const NO_FLEET = "__none__";

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
  const fleets = useFinance((s) => s.fleets);
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
  const [fleetId, setFleetId] = useState(NO_FLEET);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const activeFleets = fleets.filter((f) => f.active);

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
    setFleetId(driver?.fleetId || NO_FLEET);
    setNote(driver?.note || "");
    setSaving(false);
  }, [open, driver]);

  const selectedFleet =
    fleetId && fleetId !== NO_FLEET ? activeFleets.find((f) => f.id === fleetId) : null;
  const rentHint = selectedFleet
    ? selectedFleet.chargesRent === false || !(selectedFleet.monthlyRent > 0)
      ? `${selectedFleet.name} · no rent charged`
      : `${selectedFleet.name} · rent ${inr(selectedFleet.monthlyRent)}/mo (deducted on salary slip)`
    : "No vehicle linked · tempo rent will not apply";

  async function save() {
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
      fleetId: fleetId === NO_FLEET ? null : fleetId,
      note: note.trim(),
    };
    setSaving(true);
    try {
      upsert(row);
      const flush = await flushFinanceSave();
      if (!flush.ok) {
        toast.error(flush.error || "Saved on phone but cloud save failed");
      } else {
        toast.success(driver ? "Driver updated" : "Driver added");
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={driver ? "Edit driver" : "Add driver"}>
        <div className="space-y-4 text-left">
          <div>
            <Label htmlFor="drv-name">Name</Label>
            <Input id="drv-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <Label htmlFor="drv-mobile">Mobile</Label>
            <Input
              id="drv-mobile"
              inputMode="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="10-digit"
            />
          </div>
          <div>
            <Label>Type</Label>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setKind("full")}
                className={`h-10 flex-1 rounded-md border text-sm font-medium ${
                  kind === "full"
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line bg-raised text-muted"
                }`}
              >
                Full month
              </button>
              <button
                type="button"
                onClick={() => setKind("part")}
                className={`h-10 flex-1 rounded-md border text-sm font-medium ${
                  kind === "part"
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line bg-raised text-muted"
                }`}
              >
                Daily rate
              </button>
            </div>
          </div>
          {kind === "full" ? (
            <div>
              <Label htmlFor="drv-base">Base salary (₹ / month)</Label>
              <Input
                id="drv-base"
                inputMode="decimal"
                className="tabular-nums"
                value={base}
                onChange={(e) => setBase(e.target.value.replace(/[^0-9.]/g, ""))}
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="drv-daily">Daily rate (₹)</Label>
              <Input
                id="drv-daily"
                inputMode="decimal"
                className="tabular-nums"
                value={daily}
                onChange={(e) => setDaily(e.target.value.replace(/[^0-9.]/g, ""))}
              />
            </div>
          )}
          <div>
            <Label>Fleet / tempo</Label>
            <Select value={fleetId} onValueChange={setFleetId}>
              <SelectTrigger>
                <SelectValue placeholder="None (no rent)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_FLEET}>None (no tempo rent)</SelectItem>
                {activeFleets.map((f) => {
                  const rents =
                    f.chargesRent !== false && (f.monthlyRent || 0) > 0
                      ? ` · rent ${inr(f.monthlyRent)}`
                      : " · no rent";
                  return (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                      {f.regNo ? ` (${f.regNo})` : ""}
                      {rents}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-muted">{rentHint}</p>
            {activeFleets.length === 0 ? (
              <p className="mt-1 text-[11px] text-subtle">
                No fleets yet. Add a vehicle under More → Fleet first.
              </p>
            ) : null}
          </div>
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
          <Button className="w-full" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save driver"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
