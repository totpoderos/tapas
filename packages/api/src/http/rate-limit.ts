/**
 * Per-route override for sensitive entry points (design.md §11B.5): login and
 * join-by-code are brute-forceable, so they get a much tighter limit than the
 * rest of the API. The default of 5/minute mirrors the account-lockout
 * threshold from Slice C1 — the two defenses reinforce each other at the same
 * order of magnitude, one keyed by account, the other by source IP.
 *
 * The ceiling is tunable per deployment via `RATE_LIMIT_SENSITIVE_MAX` so that,
 * for example, a whole-system E2E run driving many logins from a single host
 * can raise it; it defaults to the secure 5 and never below 1, so a missing or
 * malformed value can only fail closed.
 */
function sensitiveMax(): number {
  const configured = Number(process.env.RATE_LIMIT_SENSITIVE_MAX);
  return Number.isFinite(configured) && configured >= 1 ? Math.floor(configured) : 5;
}

export const SENSITIVE_RATE_LIMIT = { max: sensitiveMax(), timeWindow: '1 minute' };
