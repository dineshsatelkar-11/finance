import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, MessageCircle, X } from "lucide-react";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFinance } from "@/lib/finance/store";
import { inr, shortDate, todayISO, uid } from "@/lib/finance/format";

export const Route = createFileRoute("/statement")({ component: StatementChatPage });

type SuggestKind =
  | "expense"
  | "salary"
  | "advance"
  | "extra_route"
  | "bonus"
  | "fine"
  | "loan_emi"
  | "transfer"
  | "unknown";

type ParsedLine = {
  id: string;
  date: string;
  amount: number;
  direction: "debit" | "credit";
  raw: string;
  narrative: string;
  suggestion: SuggestKind;
  confidence: "high" | "medium" | "low";
  reason: string;
  category?: string;
  driverId?: string;
  status: "pending" | "approved" | "rejected";
};

const EXPENSE_HINTS: { re: RegExp; cat: string }[] = [
  { re: /fuel|petrol|diesel|hpcl|iocl|bpcl|shell|reliance\s*petro/i, cat: "Fuel" },
  { re: /porter|packag|carton|tape|bubble/i, cat: "Porter" },
  { re: /toll|fastag/i, cat: "Toll" },
  { re: /repair|garage|service|tyre|puncture/i, cat: "Repair" },
  { re: /insurance/i, cat: "Insurance" },
  { re: /rent|warehouse|godown/i, cat: "Rent" },
];

const DRIVER_HINTS: { re: RegExp; kind: SuggestKind }[] = [
  { re: /salary|wages|payroll/i, kind: "salary" },
  { re: /advance|adv\b/i, kind: "advance" },
  { re: /extra\s*route|route\s*extra|bonus/i, kind: "extra_route" },
  { re: /fine|penalty/i, kind: "fine" },
];

function guessSuggestion(narrative: string, amount: number, direction: "debit" | "credit") {
  const text = narrative || "";
  if (/emi|loan|bajaj|hdfc.*loan|wsb|mini\s*loan/i.test(text)) {
    return { suggestion: "loan_emi" as const, confidence: "high" as const, reason: "Looks like a loan / EMI debit" };
  }
  if (/neft|imps|transfer\s*to|self|own\s*a\/c/i.test(text) && direction === "debit") {
    return { suggestion: "transfer" as const, confidence: "medium" as const, reason: "Bank transfer — may be internal move" };
  }
  for (const h of DRIVER_HINTS) {
    if (h.re.test(text)) {
      return {
        suggestion: h.kind,
        confidence: "medium" as const,
        reason: `Matched driver payout pattern (${h.kind.replace("_", " ")})`,
      };
    }
  }
  for (const h of EXPENSE_HINTS) {
    if (h.re.test(text)) {
      return {
        suggestion: "expense" as const,
        confidence: "high" as const,
        reason: `Matched expense keyword → ${h.cat}`,
        category: h.cat,
      };
    }
  }
  if (direction === "debit" && amount > 0 && amount <= 5000) {
    return {
      suggestion: "expense" as const,
      confidence: "low" as const,
      reason: "Small debit — likely expense; pick category",
      category: "Other",
    };
  }
  if (direction === "debit" && amount >= 5000) {
    return {
      suggestion: "unknown" as const,
      confidence: "low" as const,
      reason: "Larger debit — could be salary, advance, or vendor. Tell us what it was.",
    };
  }
  return { suggestion: "unknown" as const, confidence: "low" as const, reason: "Could not classify — what was this?" };
}

function parseStatementText(text: string): ParsedLine[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: ParsedLine[] = [];
  for (const raw of lines) {
    if (/^(date|particular|narration|balance|opening|closing)/i.test(raw)) continue;
    const amountMatch = raw.match(/(-?\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|-?\d+(?:\.\d{1,2})?)/g);
    if (!amountMatch || amountMatch.length === 0) continue;
    let amountStr = amountMatch[amountMatch.length - 1]!;
    for (let i = amountMatch.length - 1; i >= 0; i--) {
      const n = parseFloat(amountMatch[i]!.replace(/,/g, ""));
      if (n >= 100 || n <= -100) {
        amountStr = amountMatch[i]!;
        break;
      }
    }
    const amount = Math.abs(parseFloat(amountStr.replace(/,/g, "")) || 0);
    if (!(amount > 0)) continue;
    const isCredit = /\bCR\b|credit|deposit|received/i.test(raw) || amountStr.startsWith("+");
    const isDebit = /\bDR\b|debit|withdraw|paid/i.test(raw) || amountStr.startsWith("-") || !isCredit;
    const direction: "debit" | "credit" = isDebit && !isCredit ? "debit" : isCredit ? "credit" : "debit";

    let date = todayISO();
    const iso = raw.match(/(\d{4}-\d{2}-\d{2})/);
    const dmy = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (iso) date = iso[1]!;
    else if (dmy) {
      const dd = dmy[1]!.padStart(2, "0");
      const mm = dmy[2]!.padStart(2, "0");
      let yy = dmy[3]!;
      if (yy.length === 2) yy = `20${yy}`;
      date = `${yy}-${mm}-${dd}`;
    }

    const narrative = raw
      .replace(amountStr, " ")
      .replace(/\b(DR|CR)\b/gi, " ")
      .replace(/\d{4}-\d{2}-\d{2}/, " ")
      .replace(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/, " ")
      .replace(/\s+/g, " ")
      .trim();

    const g = guessSuggestion(narrative, amount, direction);
    out.push({
      id: uid("stmt"),
      date,
      amount,
      direction,
      raw,
      narrative: narrative || raw,
      suggestion: g.suggestion,
      confidence: g.confidence,
      reason: g.reason,
      category: g.category,
      status: "pending",
    });
  }
  return out;
}

function StatementChatPage() {
  const drivers = useFinance((s) => s.drivers);
  const banks = useFinance((s) => s.banks);
  const recordExpense = useFinance((s) => s.recordExpense);
  const recordPayout = useFinance((s) => s.recordPayout);
  const [paste, setPaste] = useState("");
  const [lines, setLines] = useState<ParsedLine[]>([]);
  const [askId, setAskId] = useState<string | null>(null);
  const [askNote, setAskNote] = useState("");

  const defaultBankId = banks.find((b) => b.isDefault)?.id || banks[0]?.id || "";
  const pending = useMemo(() => lines.filter((l) => l.status === "pending"), [lines]);
  const done = useMemo(() => lines.filter((l) => l.status !== "pending"), [lines]);

  function runParse() {
    const parsed = parseStatementText(paste);
    if (parsed.length === 0) {
      toast.error("No transactions found — paste one line per debit/credit");
      return;
    }
    setLines(parsed);
    toast.success(`Found ${parsed.length} line(s) — review suggestions`);
  }

  function setLine(id: string, patch: Partial<ParsedLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function approve(line: ParsedLine) {
    if (line.direction === "credit") {
      toast.message("Credits are not auto-booked yet — mark rejected or note manually");
      setLine(line.id, { status: "rejected" });
      return;
    }
    if (!defaultBankId) {
      toast.error("Add a bank account first");
      return;
    }
    if (line.suggestion === "expense") {
      const r = recordExpense({
        category: line.category || "Other",
        vendor: "",
        amount: line.amount,
        date: line.date,
        mode: "bank",
        bankAccountId: defaultBankId,
        note: line.narrative,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setLine(line.id, { status: "approved" });
      toast.success(`Expense ${inr(line.amount)} · ${line.category || "Other"}`);
      return;
    }
    if (["salary", "advance", "extra_route", "bonus", "fine"].includes(line.suggestion)) {
      if (!line.driverId) {
        toast.error("Pick a driver first");
        return;
      }
      const r = recordPayout({
        driverId: line.driverId,
        kind: line.suggestion as "salary" | "advance" | "extra_route" | "bonus" | "fine",
        amount: line.amount,
        date: line.date,
        mode: "bank",
        bankAccountId: defaultBankId,
        note: line.narrative,
        status: "paid",
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setLine(line.id, { status: "approved" });
      toast.success(`Payout ${line.suggestion.replace("_", " ")} · ${inr(line.amount)}`);
      return;
    }
    if (line.suggestion === "loan_emi" || line.suggestion === "transfer") {
      setLine(line.id, { status: "approved" });
      toast.message(
        line.suggestion === "loan_emi"
          ? "Noted as EMI — confirm on Loans tab after bank debit"
          : "Noted as transfer — no ledger entry created",
      );
      return;
    }
    setAskId(line.id);
    setAskNote("");
    toast.message("What was this transaction?");
  }

  function reject(line: ParsedLine) {
    setLine(line.id, { status: "rejected" });
  }

  function answerAsk() {
    if (!askId) return;
    const note = askNote.trim();
    if (!note) {
      toast.error("Type what it was");
      return;
    }
    const lower = note.toLowerCase();
    let suggestion: SuggestKind = "expense";
    let category = "Other";
    if (/salary|wage/.test(lower)) suggestion = "salary";
    else if (/advance/.test(lower)) suggestion = "advance";
    else if (/extra|route/.test(lower)) suggestion = "extra_route";
    else if (/fine/.test(lower)) suggestion = "fine";
    else if (/emi|loan/.test(lower)) suggestion = "loan_emi";
    else if (/fuel|petrol/.test(lower)) {
      suggestion = "expense";
      category = "Fuel";
    } else if (/porter|pack/.test(lower)) {
      suggestion = "expense";
      category = "Porter";
    }
    setLine(askId, {
      suggestion,
      category,
      reason: `You said: ${note}`,
      confidence: "high",
      narrative: note,
    });
    setAskId(null);
    setAskNote("");
    toast.success("Updated suggestion — Approve when ready");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Statement chat</h1>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Paste bank lines. We suggest driver payout (extra route, advance, salary…) or expense
          category. You approve or reject; unknowns ask what it was.
        </p>
      </div>

      <Card className="p-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="size-4" /> Paste statement
        </CardTitle>
        <CardHint>One transaction per line. Date + amount + narration is enough.</CardHint>
        <textarea
          className="mt-3 min-h-[140px] w-full rounded-md border border-line bg-raised px-3 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
          placeholder={`2026-09-10 -1200 HPCL Fuel Pune\n10/09/2026 14000 DR UPI-ANAND SALARY\n2026-09-09 -850 Porter packing`}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" onClick={runParse}>
            Suggest classifications
          </Button>
          {lines.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLines([]);
                setPaste("");
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </Card>

      {pending.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted">Review ({pending.length})</h2>
          {pending.map((line) => (
            <Card key={line.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium tabular-nums">
                      {line.direction === "debit" ? "−" : "+"}
                      {inr(line.amount)}
                    </span>
                    <span className="text-[12px] text-muted">{shortDate(line.date)}</span>
                    <Badge tone={line.confidence === "high" ? "ok" : "muted"}>{line.confidence}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink">{line.narrative}</p>
                  <p className="mt-1 text-[12px] text-muted">{line.reason}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-[11px]">Type</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border border-line bg-raised px-2 text-sm"
                    value={line.suggestion}
                    onChange={(e) => setLine(line.id, { suggestion: e.target.value as SuggestKind })}
                  >
                    <option value="expense">Expense</option>
                    <option value="salary">Driver salary</option>
                    <option value="advance">Driver advance</option>
                    <option value="extra_route">Extra route</option>
                    <option value="bonus">Bonus</option>
                    <option value="fine">Fine</option>
                    <option value="loan_emi">Loan EMI</option>
                    <option value="transfer">Bank transfer</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
                {line.suggestion === "expense" ? (
                  <div>
                    <Label className="text-[11px]">Category</Label>
                    <Input
                      className="mt-1"
                      value={line.category || ""}
                      onChange={(e) => setLine(line.id, { category: e.target.value })}
                      placeholder="Fuel, Porter…"
                    />
                  </div>
                ) : ["salary", "advance", "extra_route", "bonus", "fine"].includes(line.suggestion) ? (
                  <div>
                    <Label className="text-[11px]">Driver</Label>
                    <select
                      className="mt-1 h-10 w-full rounded-md border border-line bg-raised px-2 text-sm"
                      value={line.driverId || ""}
                      onChange={(e) => setLine(line.id, { driverId: e.target.value || undefined })}
                    >
                      <option value="">Select driver…</option>
                      {drivers
                        .filter((d) => d.active)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : null}
              </div>

              {askId === line.id ? (
                <div className="mt-3 rounded-md border border-line bg-raised p-3">
                  <Label className="text-[11px]">What was this?</Label>
                  <Input
                    className="mt-1"
                    value={askNote}
                    onChange={(e) => setAskNote(e.target.value)}
                    placeholder="e.g. Advance to Karan / Fuel for MH12…"
                  />
                  <div className="mt-2 flex gap-2">
                    <Button type="button" size="sm" onClick={answerAsk}>
                      Apply
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setAskId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => approve(line)}>
                  <Check className="size-3.5" /> Approve
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => reject(line)}>
                  <X className="size-3.5" /> Reject
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {done.length > 0 ? (
        <Card className="p-4">
          <CardTitle className="text-base">Done ({done.length})</CardTitle>
          <ul className="mt-3 divide-y divide-line text-sm">
            {done.map((l) => (
              <li key={l.id} className="flex justify-between gap-2 py-2">
                <span className="truncate text-muted">
                  {shortDate(l.date)} · {l.narrative}
                </span>
                <span className="shrink-0 tabular-nums">
                  {inr(l.amount)} · {l.status}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
