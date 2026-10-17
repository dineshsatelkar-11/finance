import { createFileRoute } from "@tanstack/react-router";
import { useFinance } from "@/lib/finance/store";

export const Route = createFileRoute("/invoices")({ component: InvoicesPage });

/** Temporary stub — full UI is in artifacts/invoices-feature-v1.2.0.tar.gz */
function InvoicesPage() {
  const customers = useFinance((s) => s.customers);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-medium tracking-tight">Invoices</h1>
      <p className="text-[13px] text-muted">
        Customer billing (before payment). Customers on file: {customers.length}.
      </p>
      <p className="text-sm text-muted">
        Full invoice form (create / mark paid / print / WhatsApp) is ready in the feature pack and will
        appear after the remaining store + nav files are deployed.
      </p>
    </div>
  );
}
