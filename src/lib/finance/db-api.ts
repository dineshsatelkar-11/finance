import { createServerFn } from "@tanstack/react-start";
import type { FinanceSnapshot } from "./types";

/**
 * Public DB helpers — no auth (single-tenant finance desk).
 */

export const fetchFinanceDbStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getFinanceDbStatus } = await import("./db-status.server");
    return getFinanceDbStatus();
  },
);

export const loadFinanceFromDb = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    ok: boolean;
    empty: boolean;
    data: FinanceSnapshot | null;
    error?: string;
  }> => {
    try {
      const { countBanks, loadFinanceSnapshot } = await import("./db-repo.server");
      const n = await countBanks();
      if (n === 0) {
        return { ok: true, empty: true, data: null };
      }
      const data = await loadFinanceSnapshot();
      return { ok: true, empty: false, data };
    } catch (e) {
      return {
        ok: false,
        empty: true,
        data: null,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  },
);

/** Body is the FinanceSnapshot JSON. */
export const saveFinanceToDb = createServerFn({ method: "POST" }).handler(
  async (ctx: {
    data?: FinanceSnapshot;
  }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const data = ctx.data;
      if (!data || !Array.isArray(data.banks)) {
        return { ok: false, error: "Invalid finance snapshot payload" };
      }
      const { saveFinanceSnapshot } = await import("./db-repo.server");
      await saveFinanceSnapshot(data);
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  },
);
