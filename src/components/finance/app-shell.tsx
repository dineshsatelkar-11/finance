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
  { to: "/", label: "Home", icon: LayoutDashboard, primary: true },
  { to: "/drivers", label: "Drivers", icon: Truck, primary: true },
  { to: "/payouts", label: "Pay", icon: Wallet, primary: true },
  { to: "/expenses", label: "Spend", icon: Receipt, primary: true },
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

  useEffect(() => {
    if (!moreOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [moreOpen]);

  const secondaryActive = SECONDARY.some((n) => n.to === pathname);

  return (
    <div className="relative min-h-dvh max-w-[100vw] overflow-x-clip bg-canvas text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-panel/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl min-w-0 items-center justify-between gap-2 safe-px py-2.5 sm:gap-3 sm:py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
              Satelkar’s Logistics
            </div>
            <div className="truncate font-display text-base font-medium tracking-tight text-ink sm:text-xl">
              Finance desk
            </div>
          </div>
          <label className="flex shrink-0 items-center gap-1.5 text-sm text-muted">
            <span className="sr-only sm:not-sr-only sm:inline">Month</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-9 max-w-[9.5rem] rounded-md border border-line bg-raised px-1.5 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent/25 sm:max-w-none sm:px-2 sm:text-sm"
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

      <main className="mx-auto w-full max-w-6xl min-w-0 safe-px py-4 pb-[calc(4.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 sm:pb-6">
        {dbNote ? (
          <p className="mb-3 break-words rounded-md border border-line bg-accent-soft px-3 py-2 text-[12px] text-ink">
            {dbNote}
          </p>
        ) : null}
        <p className="mb-3 text-[12px] text-subtle sm:mb-4">{monthLabel(month)}</p>
        <div className="min-w-0 w-full">{children}</div>
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel/98 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm sm:hidden"
        style={{ paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }}
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-between gap-0 px-0.5 pt-0.5">
          {PRIMARY.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md px-0.5 py-1.5 text-[10px] font-medium transition-colors",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <Icon className={cn("size-5 shrink-0", active && "stroke-[2.25]")} />
                <span className="max-w-full truncate leading-tight">{label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md px-0.5 py-1.5 text-[10px] font-medium transition-colors",
              secondaryActive || moreOpen ? "text-accent" : "text-muted",
            )}
          >
            <MoreHorizontal
              className={cn("size-5 shrink-0", (secondaryActive || moreOpen) && "stroke-[2.25]")}
            />
            <span className="leading-tight">More</span>
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
          <div
            className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl border border-line bg-panel p-4 shadow-[var(--shadow-lift)]"
            style={{
              paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
              paddingLeft: "max(1rem, env(safe-area-inset-left))",
              paddingRight: "max(1rem, env(safe-area-inset-right))",
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-medium">More</h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="inline-flex size-10 items-center justify-center rounded-md text-muted hover:bg-accent-soft hover:text-ink"
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
                      "flex min-w-0 items-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors",
                      active
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-line bg-raised text-ink hover:bg-accent-soft",
                    )}
                  >
                    <Icon className="size-5 shrink-0" />
                    <span className="truncate">{label}</span>
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
