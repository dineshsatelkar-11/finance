import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Banknote,
  LayoutDashboard,
  Receipt,
  Truck,
  Wallet,
  Car,
  Landmark,
  HandCoins,
  Building2,
  MoreHorizontal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { monthLabel } from "@/lib/finance/format";
import { useFinance } from "@/lib/finance/store";
import {
  hydrateFinanceFromDb,
  startFinanceDbSync,
} from "@/lib/finance/sync";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, primary: true },
  { to: "/drivers", label: "Drivers", icon: Truck, primary: true },
  { to: "/payouts", label: "Pay", icon: Wallet, primary: true },
  { to: "/expenses", label: "Expenses", icon: Receipt, primary: true },
  { to: "/bank", label: "Bank", icon: Banknote, primary: true },
  { to: "/fleets", label: "Fleet", icon: Car, primary: false },
  { to: "/loans", label: "Loans", icon: Landmark, primary: false },
  { to: "/receipts", label: "Receipts", icon: HandCoins, primary: false },
  { to: "/rent", label: "Rent", icon: Building2, primary: false },
] as const;

const PRIMARY = NAV.filter((n) => n.primary);
const SECONDARY = NAV.filter((n) => !n.primary);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const month = useFinance((s) => s.month);
  const setMonth = useFinance((s) => s.setMonth);
  const [moreOpen, setMoreOpen] = useState(false);
  const [dbNote, setDbNote] = useState<string | null>(null);

  useEffect(() => {
    void useFinance.persist.rehydrate();
    const unsub = startFinanceDbSync();
    void hydrateFinanceFromDb().then((r) => {
      if (!r.ok) {
        setDbNote(r.error ? `DB offline: ${r.error}` : "DB offline — using local data");
        return;
      }
      if (r.source === "seed-pushed") {
        setDbNote("Neon connected — demo data saved to database");
      } else if (r.source === "neon") {
        setDbNote("Neon connected — data loaded from database");
      }
      window.setTimeout(() => setDbNote(null), 5000);
    });
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const secondaryActive = SECONDARY.some((n) => n.to === pathname);

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-panel/92 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
              Satelkar’s Logistics
            </div>
            <div className="font-display text-lg font-medium tracking-tight text-ink sm:text-xl">
              Finance desk
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <span className="hidden sm:inline">Month</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-9 rounded-md border border-line bg-raised px-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
            />
          </label>
        </div>

        <nav className="mx-auto hidden max-w-6xl gap-1 overflow-x-auto px-2 pb-2 sm:flex sm:px-4">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-navy text-navy-fg"
                    : "text-muted hover:bg-accent-soft hover:text-ink",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6 sm:pb-6">
        {dbNote ? (
          <p className="mb-3 rounded-md border border-line bg-accent-soft px-3 py-2 text-[12px] text-ink">
            {dbNote}
          </p>
        ) : null}
        <p className="mb-4 text-[12px] text-subtle">{monthLabel(month)}</p>
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm sm:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-between px-1 pt-1">
          {PRIMARY.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md px-1 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <Icon className={cn("size-5", active && "stroke-[2.25]")} />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md px-1 py-2 text-[10px] font-medium transition-colors",
              secondaryActive || moreOpen ? "text-accent" : "text-muted",
            )}
          >
            <MoreHorizontal
              className={cn("size-5", (secondaryActive || moreOpen) && "stroke-[2.25]")}
            />
            <span>More</span>
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-50 sm:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-navy/40"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-line bg-panel p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-lift)]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-medium">More</h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-accent-soft hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SECONDARY.map(({ to, label, icon: Icon }) => {
                const active = pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-3 text-sm font-medium transition-colors",
                      active
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-line bg-raised text-ink hover:bg-accent-soft",
                    )}
                  >
                    <Icon className="size-5 shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
