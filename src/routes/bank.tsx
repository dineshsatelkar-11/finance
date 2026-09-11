import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useFinance } from "@/lib/finance/store";
import { clearAllFinanceData } from "@/lib/finance/sync";
import { inr, shortDate, uid } from "@/lib/finance/format";
import type { BankAccount } from "@/lib/finance/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bank")({ component: BankPage });

function BankPage() {
  const month = useFinance((s) => s.month);
  const banks = useFinance((s) => s.banks);
  const payouts = useFinance((s) => s.payouts);
  const expenses = useFinance((s) => s.expenses);
  const drivers = useFinance((s) => s.drivers);
  const bankTransfers = useFinance((s) => s.bankTransfers ?? []);
  const upsertBank = useFinance((s) => s.upsertBank);
  const removeBank = useFinance((s) => s.removeBank);
  const setDefaultBank = useFinance((s) => s.setDefaultBank);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [opening, setOpening] = useState("0");
  const [clearing, setClearing] = useState(false);

  const paidOut = [...payouts, ...expenses].filter(
    (r) => r.status === "paid" && r.date.startsWith(month),
  );
  const selectedBank = banks.find((b) => b.id === selectedBankId) || null;

  const ledgerRows = useMemo(() => {
    const outs = paidOut
      .filter((r) => !selectedBankId || r.bankAccountId === selectedBankId)
      .map((r) => ({
        id: r.id,
        date: r.date,
        kind: "out" as const,
        label:
          "kind" in r
            ? `${drivers.find((d) => d.id === r.driverId)?.name || "Driver"} · ${String(r.kind).replace("_", " ")}`
            : `${r.category} · ${r.vendor}`,
        sub: r.mode.toUpperCase(),
        amount: r.amount,
      }));
    const xfers = bankTransfers
      .filter(
        (x) =>
          !selectedBankId || x.fromBankId === selectedBankId || x.toBankId === selectedBankId,
      )
      .map((x) => {
        const fromName = banks.find((b) => b.id === x.fromBankId)?.name || "From";
        const toName = banks.find((b) => b.id === x.toBankId)?.name || "To";
        return {
          id: x.id,
          date: x.date,
          kind: "xfer" as const,
          label: `Transfer · ${fromName} → ${toName}`,
          sub: x.note || "Internal",
          amount: x.amount,
        };
      });
    return [...outs, ...xfers].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40);
  }, [paidOut, bankTransfers, banks, drivers, selectedBankId]);

  function saveBank() {
    const n = name.trim();
    if (!n) return;
    upsertBank({
      id: uid("bank"),
      name: n,
      opening: Math.round((Number(opening) || 0) * 100) / 100,
      isDefault: banks.length === 0,
    });
    setOpen(false);
    setName("");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Bank</h1>
          <p className="mt-1 text-sm text-muted">
            Click Warana / Bajaj / any card to show only that bank&apos;s transactions.
          </p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>
          Add bank
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Add bank">
          <div className="space-y-3 text-left">
            <div>
              <Label>Account name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Warana / Bajaj / HDFC" autoFocus />
            </div>
            <div>
              <Label>Opening balance (₹)</Label>
              <Input type="number" value={opening} onChange={(e) => setOpening(e.target.value)} />
            </div>
            <Button type="button" onClick={saveBank}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3 sm:grid-cols-2">
        {banks.map((b) => {
          const out = paidOut.filter((r) => r.bankAccountId === b.id).reduce((s, r) => s + r.amount, 0);
          const selected = selectedBankId === b.id;
          return (
            <Card
              key={b.id}
              className={cn(
                "cursor-pointer",
                selected ? "ring-2 ring-accent" : "hover:ring-1 hover:ring-line",
              )}
              onClick={() => setSelectedBankId(selected ? null : b.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{b.name}</CardTitle>
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  {b.isDefault ? <Badge tone="accent">Default</Badge> : null}
                  {selected ? <Badge tone="ok">Showing</Badge> : null}
                  {!b.isDefault ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => setDefaultBank(b.id)}>
                      Default
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!window.confirm(`Delete ${b.name}?`)) return;
                      const r = removeBank(b.id);
                      if (!r.ok) toast.error(r.error);
                      else {
                        if (selectedBankId === b.id) setSelectedBankId(null);
                        toast.message("Deleted");
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
              <CardHint>Opening {inr(b.opening)} · tap for transactions</CardHint>
              <div className="mt-4 font-display text-3xl font-medium tabular-nums">{inr(b.opening - out)}</div>
              <p className="mt-1 text-[12px] text-muted">Out this month {inr(out)}</p>
            </Card>
          );
        })}
      </div>

      {banks.length === 0 ? (
        <Card>
          <CardTitle>No banks</CardTitle>
          <CardHint>Add Warana, Bajaj, HDFC, or cash.</CardHint>
          <Button className="mt-4" onClick={() => setOpen(true)}>
            Add bank
          </Button>
        </Card>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>{selectedBank ? `${selectedBank.name} transactions` : "Ledger"}</CardTitle>
            <CardHint>
              {selectedBank ? "Filtered to this account. Tap card again to show all." : "Tap a bank card to filter."}
            </CardHint>
          </div>
          {selectedBankId ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setSelectedBankId(null)}>
              Show all
            </Button>
          ) : null}
        </div>
        <ul className="mt-4 divide-y divide-line">
          {ledgerRows.length === 0 ? (
            <li className="py-6 text-center text-sm text-muted">No transactions yet.</li>
          ) : (
            ledgerRows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <div className="font-medium capitalize">{r.label}</div>
                  <div className="text-[12px] text-muted">
                    {shortDate(r.date)} · {r.sub}
                  </div>
                </div>
                <div className={r.kind === "xfer" ? "tabular-nums text-muted" : "tabular-nums text-danger"}>
                  {r.kind === "xfer" ? "↔" : "−"}
                  {inr(r.amount)}
                </div>
              </li>
            ))
          )}
        </ul>
      </Card>

      <Button
        variant="outline"
        disabled={clearing}
        onClick={async () => {
          if (!window.confirm("Clear ALL data?")) return;
          setClearing(true);
          const res = await clearAllFinanceData();
          setClearing(false);
          if (!res.ok) window.alert(res.error || "Failed");
          else window.alert("Cleared.");
        }}
      >
        {clearing ? "Clearing…" : "Clear all data"}
      </Button>
    </div>
  );
}
