import { useEffect, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Banknote,
  LayoutDashboard,
  Receipt,
  Truck,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { monthLabel } from "@/lib/finance/format";
import { useFinance } from "@/lib/finance/store";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/drivers", label: "Drivers", icon: Truck },
  { to: "/payouts", label: "Pay", icon: Wallet },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/bank", label: "Bank", icon: Banknote },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const month = useFinance((s) => s.month);

  useEffect(() => {
    void useFinance.persist.rehydrate();
  }, []);

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
          <div className="text-right">
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">Period</div>
            <div className="text-sm font-medium tabular-nums text-ink">{monthLabel(month)}</div>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-6xl gap-1 px-4 pb-3 sm:flex sm:px-6">
          {NAV.map((item) => {
            const on = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium",
                  on ? "bg-navy text-navy-fg" : "text-muted hover:bg-accent-soft hover:text-ink",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 sm:pb-16">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:hidden">
        <div className="grid grid-cols-5">
          {NAV.map((item) => {
            const on = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  on ? "text-accent" : "text-muted",
                )}
              >
                <item.icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
