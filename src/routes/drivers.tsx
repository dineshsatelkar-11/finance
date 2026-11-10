import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2, Wallet, FileText, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaySheet } from "@/components/finance/pay-sheet";
import { useFinance } from "@/lib/finance/store";
import {
  driverBalance,
  inr,
  initials,
  monthISO,
  monthLabel,
  netSalaryPayable,
  prevMonthISO,
  salarySettlement,
  shortDate,
  suggestedSalary,
} from "@/lib/finance/format";
import { flushFinanceSave, rememberDeletedId } from "@/lib/finance/sync";
import {
  printSalarySlip,
  resolveSalarySlipMeta,
  salarySlipNote,
  slipFromSalaryPayout,
} from "@/lib/finance/salary-slip";
import type { Payout, PayoutStatus } from "@/lib/finance/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/drivers")({ component: DriversPage });

function kindLabel(kind: string, status?: string) {
  switch (kind) {
    case "salary":
      return "Salary";
    case "advance":
      return "Advance";
    case "extra_route":
      return status === "pending" ? "Extra work (unpaid)" : "Extra work (paid)";
    case "bonus":
      return "Bonus";
    case "fine":
      return "Fine";
    case "return":
      return "Return";
    default:
      return kind;
  }
}

/** Balance change for one payout (same rules as driverBalance). */
function balanceDelta(kind: string, amount: number, status: string): number {
  const a = Number(amount) || 0;
  // Unpaid extra work → company owes (+)
  if (kind === "extra_route" && status === "pending") return +a;
  // Paid extra work → no impact
  if (kind === "extra_route") return 0;
  if (status !== "paid") return 0;
  if (kind === "advance" || kind === "fine") return -a;
  if (kind === "return" || kind === "salary") return +a;
  return 0;
}

function kindChronoRank(kind: string): number {
  if (kind === "bonus") return 0;
  if (kind === "extra_route") return 0;
  if (kind === "return" || kind === "salary") return 1;
  if (kind === "advance" || kind === "fine") return 2;
  return 1;
}

function chronoCmp(a: Payout, b: Payout) {
  const byDate = a.date.localeCompare(b.date);
  if (byDate !== 0) return byDate;
  const byCreated = (a.createdAt || "").localeCompare(b.createdAt || "");
  if (byCreated !== 0) return byCreated;
  const byKind = kindChronoRank(a.kind) - kindChronoRank(b.kind);
  if (byKind !== 0) return byKind;
  return a.id.localeCompare(b.id);
}

function monthAdvances(driverId: string, month: string, payouts: Payout[]) {
  return payouts
    .filter((p) => p.driverId === driverId && p.kind === "advance" && p.status === "paid" && p.date.startsWith(month))
    .reduce((s, p) => s + p.amount, 0);
}

function DriversPage() {
  const month = useFinance((s) => s.month);
  const drivers = useFinance((s) => s.drivers);
  const payouts = useFinance((s) => s.payouts);
  const fleets = useFinance((s) => s.fleets);
  const attendances = useFinance((s) => s.attendances);
  const removePayout = useFinance((s) => s.removePayout);
  const updatePayout = useFinance((s) => s.updatePayout);
  const setAttendance = useFinance((s) => s.setAttendance);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payDriverId, setPayDriverId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDriverId, setEditDriverId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editStatus, setEditStatus] = useState<PayoutStatus>("paid");
  const [editKind, setEditKind] = useState("");
  // Salary-specific edit fields
  const [editSalaryMonth, setEditSalaryMonth] = useState(prevMonthISO());
  const [editLeave, setEditLeave] = useState("0");
  const [editBonus, setEditBonus] = useState("0");
  const [editDeduction, setEditDeduction] = useState("0");
  const [editRentOff, setEditRentOff] = useState("0");
  const [saving, setSaving] = useState(false);

  const active = drivers.filter((d) => d.active);

  const driverTx = useMemo(() => {
    if (!selectedDriverId) return [] as Payout[];
    return payouts
      .filter((p) => p.driverId === selectedDriverId)
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || "") || kindChronoRank(b.kind) - kindChronoRank(a.kind) || b.id.localeCompare(a.id));
  }, [payouts, selectedDriverId]);

  /**
   * Running balance AFTER each transaction (chronological).
   * Unpaid extra work increases company-owe; paid extra work is neutral.
   */
  const balAfterById = useMemo(() => {
    const map = new Map<string, number>();
    if (!selectedDriverId) return map;
    const d = drivers.find((x) => x.id === selectedDriverId);
    if (!d) return map;

    const chrono = payouts
      .filter((p) => p.driverId === selectedDriverId)
      .slice()
      .sort(chronoCmp);

    let bal = Math.round((Number(d.openingBalance) || 0) * 100) / 100;
    for (const p of chrono) {
      bal = Math.round((bal + balanceDelta(p.kind, p.amount, p.status)) * 100) / 100;
      map.set(p.id, bal);
    }
    return map;
  }, [payouts, selectedDriverId, drivers]);

  const editDriver = drivers.find((d) => d.id === editDriverId) || null;
  const editLeaveN = Math.max(0, Math.floor(parseFloat(editLeave) || 0));
  const editBonusN = Math.max(0, parseFloat(editBonus) || 0);
  const editDeductionN = Math.max(0, parseFloat(editDeduction) || 0);
  const editRentOffN = Math.max(0, Math.floor(parseFloat(editRentOff) || 0));
  const editSettle =
    editKind === "salary" && editDriver
      ? salarySettlement({
          driver: editDriver,
          leaveDays: editLeaveN,
          month: editSalaryMonth,
          payouts: payouts.filter((p) => p.id !== editId),
          fleets,
          bonus: editBonusN,
          deduction: editDeductionN,
          rentOffDays: editRentOffN,
          throughDate: editDate || undefined,
        })
      : null;
  const editSlipAmount = editSettle
    ? Math.round((editSettle.gross + editSettle.bonus - editSettle.rent - editSettle.deduction) * 100) / 100
    : 0;

  function openEdit(p: Payout) {
    setEditId(p.id);
    setEditDriverId(p.driverId);
    setEditAmount(String(p.amount));
    setEditDate(String(p.date || "").slice(0, 10));
    setEditNote(p.note || "");
    setEditStatus(p.status as PayoutStatus);
    setEditKind(p.kind);
    if (p.kind === "salary") {
      const meta = resolveSalarySlipMeta(p, p.driverId, attendances);
      setEditSalaryMonth(meta.month || prevMonthISO());
      setEditLeave(String(meta.leaveDays || 0));
      setEditBonus(String(meta.bonus || 0));
      setEditDeduction(String(meta.deduction || 0));
      setEditRentOff(String(meta.rentOffDays || 0));
    }
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editId) return;
    setSaving(true);
    try {
      if (editKind === "salary" && editDriver && editSettle) {
        const slip = editSlipAmount;
        if (!(slip > 0)) {
          toast.error("Salary slip amount is zero");
          setSaving(false);
          return;
        }
        const balBefore = editSettle.balance;
        const after = Math.round((balBefore + slip) * 100) / 100;
        const note = salarySlipNote({
          month: editSalaryMonth,
          leaveDays: editLeaveN,
          rentOffDays: editRentOffN,
          bonus: editBonusN,
          deduction: editDeductionN,
          rent: editSettle.rent,
          slipAmount: slip,
          balanceBefore: balBefore,
          balanceAfter: after,
          advancesBefore: editSettle.advances,
        });
        setAttendance(editDriver.id, editSalaryMonth, editLeaveN);
        updatePayout(editId, {
          amount: slip,
          date: editDate,
          note,
          status: "paid",
        });
      } else {
        const amt = parseFloat(editAmount);
        if (!(amt > 0)) {
          toast.error("Enter a valid amount");
          setSaving(false);
          return;
        }
        updatePayout(editId, {
          amount: Math.round(amt * 100) / 100,
          date: editDate,
          note: editNote.trim(),
          status: editStatus,
        });
      }
      setEditOpen(false);
      toast.success("Updated");
      const save = await flushFinanceSave();
      if (!save.ok) {
        toast.error(save.error || "Saved on phone but cloud failed");
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteTx(p: Payout) {
    if (!window.confirm("Delete this transaction?")) return;
    setDeletingId(p.id);
    rememberDeletedId(p.id);
    removePayout(p.id);
    setDeletingId(null);
    toast.message("Deleted");
    const save = await flushFinanceSave();
    if (!save.ok) {
      toast.error(save.error || "Deleted on phone but cloud failed");
    }
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Drivers</h1>
          <p className="max-w-xl text-sm text-muted">
            Balance = opening − advances − fines + returns + salary slips + unpaid extra work.
            Paid extra work does not change balance. Gross uses calendar days (leave default 0).
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/manage-drivers">Manage</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {active.length === 0 ? (
          <Card className="p-4">
            <p className="text-sm text-muted">No active drivers.</p>
          </Card>
        ) : (
          active.map((d) => {
            const bal = driverBalance(d, month, payouts);
            const leave =
              attendances.find((a) => a.driverId === d.id && a.month === month)?.leaveDays ?? 0;
            const gross = suggestedSalary(d, leave, month);
            const adv = monthAdvances(d.id, month, payouts);
            const net = netSalaryPayable(d, leave, month, payouts);
            const balClass = bal < 0 ? "text-warn" : bal > 0 ? "text-ink" : "text-muted";
            const selected = selectedDriverId === d.id;
            const opening = Math.round((Number(d.openingBalance) || 0) * 100) / 100;
            return (
              <Card
                key={d.id}
                className={cn(
                  "cursor-pointer p-4",
                  selected ? "ring-2 ring-accent" : "hover:ring-1 hover:ring-line",
                )}
                onClick={() => setSelectedDriverId(selected ? null : d.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-navy text-sm font-medium text-navy-fg">
                    {initials(d.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium">{d.name}</h2>
                      {selected ? <Badge tone="ok">Open</Badge> : null}
                    </div>
                    <p className={cn("mt-0.5 text-lg font-medium tabular-nums tracking-tight", balClass)}>
                      {inr(Math.abs(bal))}
                    </p>
                    <p className="text-[11px] text-subtle">
                      {bal > 0
                        ? "Company owes · "
                        : bal < 0
                          ? "Advance / driver owes · "
                          : "Settled · "}
                      tap to {selected ? "close" : "show"} transactions
                    </p>
                    <p className="text-[11px] text-muted tabular-nums">
                      Opening {opening < 0 ? `−${inr(Math.abs(opening))}` : inr(opening)}
                    </p>
                    {gross > 0 ? (
                      <p className="mt-1 text-[11px] text-muted tabular-nums">
                        This month salary {inr(gross)}
                        {adv > 0 ? ` − adv ${inr(adv)}` : ""}
                        {" → "}
                        <span className={net < 0 ? "text-warn" : "text-ink"}>net {inr(net)}</span>
                        <span className="text-subtle"> · slip → balance; cash ~10th as advance</span>
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setPayDriverId(d.id);
                        setPayOpen(true);
                      }}
                    >
                      <Wallet className="size-3.5" /> Pay
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDriverId(selected ? null : d.id)}
                    >
                      Transactions
                    </Button>
                  </div>

                  {selected ? (
                    <div className="mt-4 border-t border-line pt-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-[12px] font-medium text-muted">Transactions</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => setSelectedDriverId(null)}
                        >
                          Close
                        </Button>
                      </div>
                      <ul className="divide-y divide-line">
                        {driverTx.length === 0 ? (
                          <li className="py-4 text-center text-sm text-muted">No transactions for this driver yet.</li>
                        ) : (
                          driverTx.map((p) => {
                            const isIn = p.kind === "return" || (p.kind === "extra_route" && p.status === "pending");
                            const isNeutral = p.kind === "bonus" || (p.kind === "extra_route" && p.status === "paid");
                            const isSalary = p.kind === "salary";
                            const after = balAfterById.get(p.id);
                            return (
                              <li key={p.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium">{kindLabel(p.kind, p.status)}</div>
                                  <div className="text-[12px] text-muted">
                                    {shortDate(p.date)} · {p.status}
                                    {p.note ? ` · ${p.note}` : ""}
                                  </div>
                                  {after != null ? (
                                    <div
                                      className={cn(
                                        "mt-0.5 text-[11px] tabular-nums",
                                        after < 0 ? "text-warn" : after > 0 ? "text-muted" : "text-subtle",
                                      )}
                                    >
                                      After:{" "}
                                      {after < 0
                                        ? `−${inr(Math.abs(after))} (owes)`
                                        : after > 0
                                          ? `${inr(after)} (company owes)`
                                          : inr(0)}
                                    </div>
                                  ) : null}
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                  <div
                                    className={cn(
                                      "tabular-nums",
                                      isIn || isSalary ? "text-ok" : isNeutral ? "text-muted" : "text-danger",
                                    )}
                                  >
                                    {isIn || isSalary ? "+" : isNeutral ? "" : "−"}
                                    {inr(p.amount)}
                                  </div>
                                  {isSalary ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 px-2 text-[11px]"
                                      onClick={() => {
                                        const data = slipFromSalaryPayout(
                                          d,
                                          p,
                                          payouts,
                                          fleets,
                                          0,
                                          attendances,
                                        );
                                        printSalarySlip(data);
                                      }}
                                    >
                                      <FileText className="size-3.5" />
                                      Slip
                                    </Button>
                                  ) : null}
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => openEdit(p)}
                                    title="Edit"
                                  >
                                    <Pencil className="size-3.5" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    disabled={deletingId === p.id}
                                    onClick={() => deleteTx(p)}
                                    title="Delete"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>
                              </li>
                            );
                          })
                        )}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })
        )}
      </div>

      <PaySheet
        open={payOpen}
        onOpenChange={setPayOpen}
        driverId={payDriverId}
        onDriverIdChange={setPayDriverId}
      />

      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditId(null); }}>
        <DialogContent title={editKind === "salary" ? "Edit salary slip" : "Edit transaction"}>
          <div className="space-y-3 text-left">
            {editKind === "salary" ? (
              <>
                <p className="text-[12px] text-muted">
                  Same form as Post salary slip — leave, bonus, deduction, rent off update the slip amount.
                </p>
                <div>
                  <Label>Salary for month</Label>
                  <Select
                    value={editSalaryMonth}
                    onValueChange={(ym) => {
                      setEditSalaryMonth(ym);
                      const att = attendances.find((a) => a.driverId === editDriverId && a.month === ym);
                      if (att) setEditLeave(String(att.leaveDays ?? 0));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3].map((back) => {
                        let ym = monthISO();
                        for (let i = 0; i < back; i++) ym = prevMonthISO(ym);
                        return (
                          <SelectItem key={ym} value={ym}>
                            {monthLabel(ym)}
                            {back === 1 ? " (typical)" : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Leave days</Label>
                    <Input inputMode="numeric" value={editLeave} onChange={(e) => setEditLeave(e.target.value)} />
                  </div>
                  <div>
                    <Label>Bonus ₹</Label>
                    <Input inputMode="decimal" value={editBonus} onChange={(e) => setEditBonus(e.target.value)} />
                  </div>
                  <div>
                    <Label>Deduction ₹</Label>
                    <Input inputMode="decimal" value={editDeduction} onChange={(e) => setEditDeduction(e.target.value)} />
                  </div>
                  <div>
                    <Label>Rent off days</Label>
                    <Input inputMode="numeric" value={editRentOff} onChange={(e) => setEditRentOff(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Slip date</Label>
                  <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                </div>
                {editSettle ? (
                  <div className="rounded-md border border-line p-2.5 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted">Gross</span>
                      <span className="tabular-nums">{inr(editSettle.gross)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Balance till date</span>
                      <span className="tabular-nums">{inr(editSettle.balance)}</span>
                    </div>
                    {editSettle.rent > 0 ? (
                      <div className="flex justify-between">
                        <span className="text-muted">
                          Tempo rent{editSettle.rentFleetName ? ` (${editSettle.rentFleetName})` : ""}
                        </span>
                        <span className="tabular-nums">−{inr(editSettle.rent)}</span>
                      </div>
                    ) : null}
                    {editBonusN > 0 ? (
                      <div className="flex justify-between">
                        <span className="text-muted">Bonus</span>
                        <span className="tabular-nums">{inr(editBonusN)}</span>
                      </div>
                    ) : null}
                    {editDeductionN > 0 ? (
                      <div className="flex justify-between">
                        <span className="text-muted">Deduction</span>
                        <span className="tabular-nums">−{inr(editDeductionN)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between border-t border-line pt-1 font-medium">
                      <span>Salary slip amount</span>
                      <span className="tabular-nums">{inr(editSlipAmount)}</span>
                    </div>
                  </div>
                ) : null}
                <p className="text-[11px] text-muted">
                  Slip accrues to driver balance. Cash around 10th is recorded as advance.
                </p>
              </>
            ) : (
              <>
                <p className="text-[12px] text-muted">
                  {editKind === "extra_route"
                    ? "Extra work: Paid = no balance change · Unpaid = company owes"
                    : kindLabel(editKind)}
                </p>
                <div>
                  <Label>Amount ₹</Label>
                  <Input
                    inputMode="decimal"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                </div>
                {editKind === "extra_route" ? (
                  <div>
                    <Label>Status</Label>
                    <Select value={editStatus} onValueChange={(v) => setEditStatus(v as PayoutStatus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Unpaid — company owes</SelectItem>
                        <SelectItem value="paid">Paid — no balance change</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div>
                    <Label>Status</Label>
                    <Select value={editStatus} onValueChange={(v) => setEditStatus(v as PayoutStatus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Note</Label>
                  <Input value={editNote} onChange={(e) => setEditNote(e.target.value)} />
                </div>
              </>
            )}
            <div className="flex gap-2 pt-1">
              <Button type="button" onClick={saveEdit} disabled={saving}>
                {saving ? "Saving…" : editKind === "salary" ? "Update salary slip" : "Save"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
