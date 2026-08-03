import type { Clock } from '../audit/audit-projection.js';
import type { Database } from '../db/database.js';
import { DatabaseRateLimitStore } from './rate-limit-store.js';

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

/**
 * The store the limiter counts in — the database, so a deployment answering from
 * several instances counts once rather than once each.
 *
 * Returned as a constructor because that is the shape the plugin wants: it makes
 * one per route through `child()`. The deployment's own database and clock are
 * closed over, which is why this is a function of the deps rather than a class
 * the plugin could construct itself.
 */
export function rateLimitStoreFor(deps: {
  readonly database: Database;
  readonly clock: Clock;
}): new () => DatabaseRateLimitStore {
  return class ScopedStore extends DatabaseRateLimitStore {
    constructor() {
      super(deps);
    }
  };
}
