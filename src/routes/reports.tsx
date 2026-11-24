import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Download,
  Printer,
  Filter,
  Truck,
  Receipt,
  Wallet,
  Landmark,
  HandCoins,
  Banknote,
  LayoutList,
  ListOrdered,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/lib/finance/store";
import { inr, shortDate, todayISO } from "@/lib/finance/format";
import { buildPartyStatement, printPartyStatement } from "@/lib/finance/party-statement";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

// NOTE: Full reports page body is large — loaded from restored artifact in next commit if truncated.
function ReportsPage() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-medium">Reports</h1>
      <p className="text-sm text-muted">Loading full page… if you see this, deploy is incomplete.</p>
    </div>
  );
}
