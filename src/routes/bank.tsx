import { createFileRoute } from "@tanstack/react-router";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFinance } from "@/lib/finance/store";
import { inr, shortDate } from "@/lib/finance/format";

export const Route = createFileRoute("/bank")({ component: BankPage });

function BankPage() {
  const month = useFinance((s) => s.month);
  const banks = useFinance((s) => s.banks);
  const payouts = useFinance((s) => s.payouts);
  const expenses = useFinance((s) => s.expenses);
  const drivers = useFinance((s) => s.drivers);
  const resetDemo = useFinance((s) => s.resetDemo);

  const paidOut = [...payouts, ...expenses].filter(
    (r) => r.status === "paid" && r.date.startsWith(month),
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Bank</h1>
        <p className="mt-1 text-sm text-muted">Opening balances plus this month’s confirmed outflows. Pending UPI is not deducted.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {banks.map((b) => {
          const out = paidOut.filter((r) => r.bankAccountId === b.id).reduce((s, r) => s + r.amount, 0);
          return (
            <Card key={b.id}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{b.name}</CardTitle>
                {b.isDefault ? <Badge tone="accent">Default</Badge> : null}
              </div>
              <CardHint>Opening {inr(b.opening)}</CardHint>
              <div className="mt-4 font-display text-3xl font-medium tabular-nums tracking-tight">
                {inr(b.opening - out)}
              </div>
              <p className="mt-1 text-[12px] text-muted">Out this month {inr(out)}</p>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardTitle>Ledger</CardTitle>
        <CardHint>Confirmed movements only.</CardHint>
        <ul className="mt-4 divide-y divide-line">
          {paidOut
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 20)
            .map((r) => {
              const label =
                "kind" in r
                  ? `${drivers.find((d) => d.id === r.driverId)?.name || "Driver"} · ${String(r.kind).replace("_", " ")}`
                  : `${r.category} · ${r.vendor}`;
              return (
                <li key={r.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <div className="font-medium capitalize">{label}</div>
                    <div className="text-[12px] text-muted">
                      {shortDate(r.date)} · {r.mode.toUpperCase()}
                    </div>
                  </div>
                  <div className="tabular-nums text-danger">−{inr(r.amount)}</div>
                </li>
              );
            })}
        </ul>
      </Card>

      <Button variant="outline" onClick={() => resetDemo()}>
        Reset demo data
      </Button>
    </div>
  );
}
