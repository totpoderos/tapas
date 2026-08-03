import type { Clock } from '../audit/audit-projection.js';
import type { Database } from '../db/database.js';

/**
 * What `@fastify/rate-limit` asks of a store: increment one key and say where it
 * now stands. Declared here rather than imported because the plugin's own type
 * is a constructor shape, and what this file wants to describe is the object.
 */
export interface RateLimitStore {
  incr(
    key: string,
    callback: (error: Error | null, result?: { current: number; ttl: number }) => void,
    timeWindow: number,
    max: number,
  ): void;
  child(routeOptions: { readonly routeInfo?: { readonly url?: string; readonly method?: string } }): RateLimitStore;
}

export interface RateLimitStoreDeps {
  readonly database: Database;
  readonly clock: Clock;
}

/**
 * How often a stale bucket sweep is worth doing — far longer than any window, so
 * it costs nothing and the table still cannot grow forever.
 */
const SWEEP_EVERY_MS = 60 * 60 * 1000;

/**
 * Counts attempts in the database, so a deployment has one count however many
 * instances are answering.
 *
 * The plugin's default store is a map in one process's memory, which is right
 * for a single process and quietly wrong for several: five attempts a minute
 * becomes five per instance, and every cold start begins again at zero. Nothing
 * about a request or a log would show the difference — which is why this is
 * worth a table rather than a note in the threat model.
 *
 * Counting and resetting are one statement on purpose. Read-then-write is the
 * race this exists to lose: two instances would both read four and both write
 * five. `ON CONFLICT … DO UPDATE` with `RETURNING` says it in one round trip and
 * both databases understand it.
 */
export class DatabaseRateLimitStore implements RateLimitStore {
  private lastSweep = 0;

  constructor(
    private readonly deps: RateLimitStoreDeps,
    private readonly route = 'global',
  ) {}

  /** One store per route, so the same address is counted separately per entry point. */
  child(routeOptions: {
    readonly routeInfo?: { readonly url?: string; readonly method?: string };
  }): RateLimitStore {
    const info = routeOptions.routeInfo;
    return new DatabaseRateLimitStore(this.deps, `${info?.method ?? ''} ${info?.url ?? ''}`.trim() || 'global');
  }

  incr(
    key: string,
    callback: (error: Error | null, result?: { current: number; ttl: number }) => void,
    timeWindow: number,
    _max: number,
  ): void {
    void this.count(key, timeWindow).then(
      (result) => callback(null, result),
      // Handed to the plugin as an error rather than swallowed. Registered with
      // `skipOnError: false`, that refuses the request — which is the answer a
      // brute-force control should give when it cannot count.
      (error: unknown) => callback(error instanceof Error ? error : new Error(String(error))),
    );
  }

  private async count(key: string, timeWindow: number): Promise<{ current: number; ttl: number }> {
    const now = Date.parse(this.deps.clock.now());
    const nowIso = new Date(now).toISOString();
    const opensAfter = new Date(now - timeWindow).toISOString();
    const bucket = `${this.route}|${key}`;

    /*
     * Reset or increment, and say which. The `CASE` is what folds "has the
     * window passed?" into the same statement as the increment — asking first
     * and writing after is exactly the gap two instances slip through.
     */
    const row = (await this.deps.database
      .prepare(
        `INSERT INTO rate_limits (bucket, count, window_started_at) VALUES (?, 1, ?)
         ON CONFLICT (bucket) DO UPDATE SET
           count = CASE WHEN rate_limits.window_started_at <= ? THEN 1 ELSE rate_limits.count + 1 END,
           window_started_at = CASE WHEN rate_limits.window_started_at <= ? THEN ? ELSE rate_limits.window_started_at END
         RETURNING count, window_started_at`,
      )
      .get(bucket, nowIso, opensAfter, opensAfter, nowIso)) as {
      count: number;
      window_started_at: string;
    };

    await this.sweep(now, timeWindow);

    const elapsed = now - Date.parse(row.window_started_at);
    return { current: Number(row.count), ttl: Math.max(0, timeWindow - elapsed) };
  }

  /**
   * Drops buckets nothing has touched for far longer than any window.
   *
   * On the same path rather than on a timer: a timer is a thing to start, stop,
   * and forget to stop in a test, for a table that holds one row per address
   * recently seen.
   */
  private async sweep(now: number, timeWindow: number): Promise<void> {
    if (now - this.lastSweep < SWEEP_EVERY_MS) return;
    this.lastSweep = now;
    const staleBefore = new Date(now - Math.max(timeWindow, SWEEP_EVERY_MS) * 2).toISOString();
    await this.deps.database.prepare('DELETE FROM rate_limits WHERE window_started_at < ?').run(staleBefore);
  }
}
