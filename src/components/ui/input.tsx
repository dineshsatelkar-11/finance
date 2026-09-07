import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-md border border-line bg-raised px-3 text-sm text-ink",
        "placeholder:text-subtle outline-none transition-[border-color,box-shadow] duration-150",
        "focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
