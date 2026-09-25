# Production deploys from `master` (not `main`)

Vercel production tracks **master** at the last good build.

2026-09-25: fixes for
- empty UPI/mobile no longer overwrites Neon values (CASE WHEN)
- bank/txn deletes: DELETE+reinsert txn tables so removed rows leave Neon
- bank UI: await flush + tombstone id so reopen cannot resurrect deleted rows
