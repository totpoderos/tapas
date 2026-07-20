/**
 * Per-route override for sensitive entry points (design.md §11B.5): login and
 * join-by-code are brute-forceable, so they get a much tighter limit than the
 * rest of the API. 5/minute mirrors the account-lockout threshold from
 * Slice C1 — the two defenses reinforce each other at the same order of
 * magnitude, one keyed by account, the other by source IP.
 */
export const SENSITIVE_RATE_LIMIT = { max: 5, timeWindow: '1 minute' };
