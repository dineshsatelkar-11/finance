import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { title: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-navy/45" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2",
          "rounded-xl border border-line bg-panel p-5 text-left shadow-[var(--shadow-lift)]",
          "max-h-[min(90dvh,720px)] overflow-y-auto",
          className,
        )}
        {...props}
      >
        <div className="mb-4 flex items-start justify-between gap-3 text-left">
          <DialogPrimitive.Title className="font-display text-xl font-medium tracking-tight text-ink">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted hover:bg-accent-soft hover:text-ink">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </div>
        <div className="text-left">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
