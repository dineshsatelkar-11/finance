import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-panel p-5 shadow-[var(--shadow-lift)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2 className={cn("font-display text-lg font-medium tracking-tight text-ink", className)} {...props} />
  );
}

export function CardHint({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("mt-1 text-sm text-muted", className)} {...props} />;
}
