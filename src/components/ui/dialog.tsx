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
          "fixed z-50 flex max-h-[min(92dvh,720px)] w-full flex-col border border-line bg-panel shadow-[var(--shadow-lift)]",
          "inset-x-0 bottom-0 rounded-t-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
          "sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[calc(100%-1.5rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:p-5",
          className,
        )}
        {...props}
      >
        <div className="mb-3 flex shrink-0 items-start justify-between gap-3 sm:mb-4">
          <DialogPrimitive.Title className="min-w-0 flex-1 font-display text-lg font-medium tracking-tight text-ink sm:text-xl">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted hover:bg-accent-soft hover:text-ink">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-clip overscroll-contain">
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
