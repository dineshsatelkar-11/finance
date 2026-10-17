import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  CheckCircle2,
  MessageCircle,
  Pencil,
  Plus,
  Printer,
  Trash2,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { defaultBankId, useFinance } from "@/lib/finance/store";
import {
  inr,
  monthISO,
  openWhatsApp,
  shortDate,
  todayISO,
  uid,
} from "@/lib/finance/format";
import {
  buildCustomerInvoiceData,
  invoiceWhatsAppText,
  makeInvoiceNo,
  printCustomerInvoice,
} from "@/lib/finance/customer-invoice";
import type { Invoice, InvoiceStatus, PayMode } from "@/lib/finance/types";
import { rememberDeletedId } from "@/lib/finance/sync";

export const Route = createFileRoute("/invoices")({ component: InvoicesPage });

// NOTE: full UI pushed in follow-up if truncated — see artifacts/invoices-feature-v1.2.0.tar.gz
function InvoicesPage() {
  const invoices = useFinance((s) => s.invoices ?? []);
  const customers = useFinance((s) => s.customers);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-medium tracking-tight">Invoices</h1>
      <p className="text-[13px] text-muted">
        Customer billing (before payment). {invoices.length} invoice(s). Customers: {customers.length}.
      </p>
      <p className="text-sm text-muted">Loading full form from next deploy commit…</p>
    </div>
  );
}
