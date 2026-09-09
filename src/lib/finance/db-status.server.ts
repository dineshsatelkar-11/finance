/**
 * Server-only: report whether Neon / PGLite is active and finance tables exist.
 * Call only from createServerFn handlers — never from the browser.
 */
import { getSql, dbSource } from "@/lib/db";

export type FinanceDbStatus = {
  source: "neon" | "pglite";
  databaseUrlSet: boolean;
  tables: Record<string, boolean>;
  ok: boolean;
  message: string;
};

const EXPECTED = [
  "banks",
  "fleets",
  "loans",
  "drivers",
  "vendors",
  "customers",
  "payouts",
  "expenses",
  "receipts",
  "rent_payments",
  "loan_payments",
  "attendances",
  "rent_waivers",
] as const;

export async function getFinanceDbStatus(): Promise<FinanceDbStatus> {
  const databaseUrlSet = Boolean(
    typeof process !== "undefined" && process.env.DATABASE_URL?.trim(),
  );

  try {
    const sql = await getSql();
    const rows = await sql.query<{ table_name: string }>(
      `select table_name
       from information_schema.tables
       where table_schema = 'public'
         and table_type = 'BASE TABLE'`,
    );
    const present = new Set(rows.map((r) => r.table_name));
    const tables: Record<string, boolean> = {};
    for (const name of EXPECTED) {
      tables[name] = present.has(name);
    }
    const missing = EXPECTED.filter((n) => !tables[n]);
    const ok = missing.length === 0;
    return {
      source: dbSource,
      databaseUrlSet,
      tables,
      ok,
      message: ok
        ? `Connected via ${dbSource}. All ${EXPECTED.length} finance tables present.`
        : `Connected via ${dbSource}, but missing tables: ${missing.join(", ")}. Redeploy after adding migrations/0002_finance.sql.`,
    };
  } catch (e) {
    return {
      source: dbSource,
      databaseUrlSet,
      tables: Object.fromEntries(EXPECTED.map((n) => [n, false])),
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
