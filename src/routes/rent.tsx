import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFinance } from "@/lib/finance/store";
import {
  effectiveRent,
  inr,
  monthLabel,
  openWhatsApp,
  shortDate,
  todayISO,
} from "@/lib/finance/format";
import type { PayMode } from "@/lib/finance/types";

export const Route = createFileRoute("/rent")({ component: RentPage });

function RentPage() {
  const month = useFinance((s) => s.month);
  const fleets = useFinance((s) => s.fleets);
  const drivers = useFinance((s) => s.drivers);
  const rentPayments = useFinance((s) => s.rentPayments);
  const rentWaivers = useFinance((s) => s.rentWaivers);
  const recordRent = useFinance((s) => s.recordRent);
  const setRentWaiver = useFinance((s) => s.setRentWaiver);
  const [breakDays, setBreakDays] = useState("0");
  const [waiverNote, setWaiverNote] = useState("");

  const rentFleets = fleets.filter((f) => f.active && f.monthlyRent > 0);

  const [fleetId, setFleetId] = useState(rentFleets[0]?.id || fleets[0]?.id || "");
  const [driverId, setDriverId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState<PayMode>("cash");
  const [note, setNote] = useState("");
  const [lastId, setLastId] = useState<string | null>(null);

  const fleet = fleets.find((f) => f.id === fleetId);
  const assigned = drivers.filter((d) => d.active && d.fleetId === fleetId);
  const effectiveDriverId =
    driverId || assigned[0]?.id || drivers.find((d) => d.active)?.id || "";

  // When fleet changes, default amount to monthly rent
  const suggested = fleet?.monthlyRent || 0;

  const monthRows = useMemo(
    () => rentPayments.filter((r) => r.forMonth === month || r.date.startsWith(month)),
    [rentPayments, month],
  );
  const collected = monthRows
    .filter((r) => r.status === "paid")
    .reduce((s, r) => s + r.amount, 0);

  const dueBoard = rentFleets.map((f) => {
    const paid = monthRows
      .filter((r) => r.fleetId === f.id && r.status === "paid")
      .reduce((s, r) => s + r.amount, 0);
    const w = rentWaivers.find((x) => x.fleetId === f.id && x.month === month);
    const expected = effectiveRent(f.monthlyRent, w?.breakdownDays || 0, w?.amount || 0);
    const due = Math.max(0, expected - paid);
    const drv = drivers.find((d) => d.fleetId === f.id && d.active);
    return { fleet: f, paid, due, expected, waiver: w, driver: drv };
  });

  const last = rentPayments.find((r) => r.id === lastId);

  function save() {
    const amt = parseFloat(amount || String(suggested));
    const r = recordRent({
      fleetId,
      driverId: effectiveDriverId,
      amount: amt,
      date,
      forMonth: month,
      mode,
      note,
    });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setLastId(r.id);
    toast.success("Rent recorded — WhatsApp available");
    setAmount("");
    setNote("");
  }

  function shareWa(r: (typeof rentPayments)[0]) {
    const d = drivers.find((x) => x.id === r.driverId);
    const f = fleets.find((x) => x.id === r.fleetId);
    const text = [
      `Satelkar's Logistics — fleet rent receipt`,
      ``,
      `Driver: ${d?.name || "—"}`,
      `Fleet: ${f?.name || "—"} ${f?.regNo || ""}`,
      `For: ${monthLabel(r.forMonth)}`,
      `Amount: ${inr(r.amount)}`,
      `Date: ${shortDate(r.date)}`,
      `Mode: ${r.mode.toUpperCase()}`,
      r.note ? `Note: ${r.note}` : null,
      ``,
      `Thank you.`,
    ]
      .filter(Boolean)
      .join("\n");
    openWhatsApp(d?.mobile || "", text);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Fleet rent</h1>
        <p className="mt-1 text-sm text-muted">
          Track rent drivers pay for vehicles. Collected this month {inr(collected)}.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dueBoard.map(({ fleet: f, paid, due, expected, waiver, driver }) => (
          <Card key={f.id} className="p-4">
            <CardTitle className="text-base">{f.name}</CardTitle>
            <CardHint>
              Base {inr(f.monthlyRent)}/mo
              {waiver?.breakdownDays
                ? ` · −${waiver.breakdownDays}d breakdown → ${inr(expected)}`
                : ""}
              {driver ? ` · ${driver.name}` : " · no driver assigned"}
            </CardHint>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-[11px] uppercase text-muted">Paid</div>
                <div className="font-medium tabular-nums text-ok">{inr(paid)}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase text-muted">Balance</div>
                <div
                  className={`font-display text-xl font-medium tabular-nums ${
                    due > 0 ? "text-warn" : "text-ok"
                  }`}
                >
                  {inr(due)}
                </div>
              </div>
            </div>
            {due <= 0 ? <Badge tone="ok" className="mt-2">Settled</Badge> : (
              <Badge tone="warn" className="mt-2">Pending</Badge>
            )}
          </Card>
        ))}
        {dueBoard.length === 0 ? (
          <p className="text-sm text-muted col-span-full">
            Set monthly rent on a fleet under Fleet, then collect here.
          </p>
        ) : null}
      </div>

      <Card>
        <h2 className="font-display text-lg font-medium">Breakdown / rent waiver</h2>
        <p className="mt-1 text-sm text-muted">
          If the vehicle was off-road, those days are not charged. Effective rent =
          monthly − (monthly ÷ 30 × breakdown days).
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Fleet</Label>
            <Select value={fleetId} onValueChange={setFleetId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fleets
                  .filter((f) => f.active)
                  .map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name} · base {inr(f.monthlyRent)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="bd-days">Breakdown days (this month)</Label>
            <Input
              id="bd-days"
              inputMode="numeric"
              value={breakDays}
              onChange={(e) => setBreakDays(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="bd-note">Note</Label>
            <Input
              id="bd-note"
              value={waiverNote}
              onChange={(e) => setWaiverNote(e.target.value)}
              placeholder="e.g. Gearbox repair 3–5 Sep"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            onClick={() => {
              if (!fleetId) {
                toast.error("Select a fleet");
                return;
              }
              const days = Math.max(0, Math.floor(parseFloat(breakDays) || 0));
              setRentWaiver(fleetId, month, days, 0, waiverNote);
              const f = fleets.find((x) => x.id === fleetId);
              const eff = f ? effectiveRent(f.monthlyRent, days) : 0;
              setAmount(String(eff));
              toast.success(
                days
                  ? `Waiver saved · effective rent ${inr(eff)}`
                  : "Waiver cleared · full monthly rent",
              );
            }}
          >
            Save breakdown days
          </Button>
          <span className="text-sm text-muted">
            {fleet
              ? `Effective rent now ${inr(
                  effectiveRent(
                    fleet.monthlyRent,
                    rentWaivers.find((w) => w.fleetId === fleetId && w.month === month)
                      ?.breakdownDays || Math.floor(parseFloat(breakDays) || 0),
                  ),
                )}`
              : ""}
          </span>
        </div>
      </Card>

      {last ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-ok/30 bg-ok-soft/40 p-4">
          <div>
            <div className="text-sm font-medium text-ok">Last rent · {inr(last.amount)}</div>
            <p className="text-[13px] text-muted">
              {drivers.find((d) => d.id === last.driverId)?.name} ·{" "}
              {fleets.find((f) => f.id === last.fleetId)?.name}
            </p>
          </div>
          <Button variant="outline" onClick={() => shareWa(last)}>
            <MessageCircle className="size-4" /> WhatsApp
          </Button>
        </Card>
      ) : null}

      <Card>
        <h2 className="font-display text-lg font-medium">Record rent payment</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Fleet</Label>
            <Select
              value={fleetId}
              onValueChange={(v) => {
                setFleetId(v);
                const f = fleets.find((x) => x.id === v);
                if (f) {
                  const w = rentWaivers.find((x) => x.fleetId === v && x.month === month);
                  setAmount(String(effectiveRent(f.monthlyRent, w?.breakdownDays || 0, w?.amount || 0)));
                  setBreakDays(String(w?.breakdownDays || 0));
                }
                const d = drivers.find((x) => x.fleetId === v && x.active);
                if (d) setDriverId(d.id);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select fleet" />
              </SelectTrigger>
              <SelectContent>
                {fleets
                  .filter((f) => f.active)
                  .map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                      {f.monthlyRent > 0 ? ` · ${inr(f.monthlyRent)}/mo` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Driver paying</Label>
            <Select value={effectiveDriverId} onValueChange={setDriverId}>
              <SelectTrigger>
                <SelectValue placeholder="Select driver" />
              </SelectTrigger>
              <SelectContent>
                {drivers
                  .filter((d) => d.active)
                  .map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                      {d.fleetId === fleetId ? " (assigned)" : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="rn-amt">Amount (₹)</Label>
            <Input
              id="rn-amt"
              type="number"
              inputMode="decimal"
              placeholder={suggested ? String(suggested) : ""}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="rn-date">Date</Label>
            <Input id="rn-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as PayMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="rn-note">Note</Label>
            <Input id="rn-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <Button className="mt-4" onClick={save}>
          Save rent payment
        </Button>
      </Card>

      <div className="space-y-2">
        <h2 className="font-display text-lg font-medium">{monthLabel(month)} payments</h2>
        {monthRows.map((r) => {
          const d = drivers.find((x) => x.id === r.driverId);
          const f = fleets.find((x) => x.id === r.fleetId);
          return (
            <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{d?.name || "Driver"}</span>
                  <Badge tone="muted">{f?.name || "Fleet"}</Badge>
                </div>
                <p className="mt-1 text-[12px] text-muted">
                  {shortDate(r.date)} · {r.mode.toUpperCase()}
                  {r.note ? ` · ${r.note}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium tabular-nums">{inr(r.amount)}</span>
                <Button size="sm" variant="outline" onClick={() => shareWa(r)}>
                  <MessageCircle className="size-4" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
