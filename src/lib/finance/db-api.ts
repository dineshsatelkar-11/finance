import { createServerFn } from "@tanstack/react-start";

/**
 * Public DB health check — no auth required.
 * Safe for single-tenant finance desk while login is still off.
 */
export const fetchFinanceDbStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getFinanceDbStatus } = await import("./db-status.server");
    return getFinanceDbStatus();
  },
);
