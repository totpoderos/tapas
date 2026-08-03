import pg, { Pool, type PoolClient } from 'pg';
import type { Database, PreparedStatement, SqlValue, StatementResult } from './database.js';

/*
 * Count columns come back as numbers, not strings.
 *
 * Postgres answers `COUNT(*)` as `int8`, and the driver hands `int8` back as a
 * string so that values beyond 2^53 survive. SQLite answers the same query with
 * a number. Two repositories read counts — the roster's claimed places and the
 * vote sessions per status — so left alone, the same code would compare a
 * string against a number on one database and not the other, which is precisely
 * the divergence this port exists to prevent.
 *
 * Safe here because these are counts of people at a dinner: a contest large
 * enough to lose precision is not a contest. Set once, at module load, because
 * the driver's parsers are global to the process.
 */
pg.types.setTypeParser(pg.types.builtins.INT8, (value: string) => Number(value));

/**
 * Rewrites SQLite's `?` placeholders into Postgres's `$1 … $n`.
 *
 * This is the whole reason the strategy sits at the driver rather than at the
 * repository: 189 statements are written once, in one dialect, and the one
 * database that spells placeholders differently translates them here. Two copies
 * of every query would have been the alternative, and two bodies of SQL only
 * ever exercised separately is this project's recurring bug shape.
 *
 * A `?` inside a string literal is not a placeholder, so quoted text is stepped
 * over rather than rewritten — no statement does this today, and finding out the
 * hard way that one had started to would be an unpleasant way to learn it.
 */
export function toNumberedPlaceholders(sql: string): string {
  let out = '';
  let n = 0;
  let quote: string | null = null;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i]!;
    if (quote) {
      out += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      out += char;
      continue;
    }
    if (char === '?') {
      n += 1;
      out += `$${n}`;
      continue;
    }
    out += char;
  }
  return out;
}

/**
 * The `Database` served by Postgres over a connection pool.
 *
 * Where the SQLite adapter has one connection and no waiting, this one has many
 * connections and every call is a round trip. Two things follow, and both are
 * the reason the port hands over work rather than handing out a connection:
 *
 * - **A transaction pins one connection** for its whole life. Spreading a
 *   transaction's statements across whichever connection happened to be free is
 *   how half a change commits — and it would pass every single-user test.
 * - **Statements outside a transaction** take any connection from the pool,
 *   which is what makes concurrency worth having.
 */
export class PostgresDatabase implements Database {
  private readonly pool: Pool;

  /**
   * The connection a transaction has pinned, while one is running.
   *
   * Held here rather than threaded through every repository because the
   * repositories must not know: they are written once, for both databases, and
   * SQLite has no such thing to thread.
   */
  private pinned: PoolClient | null = null;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  private async run(sql: string, params: readonly SqlValue[]): Promise<{ rows: unknown[]; count: number }> {
    const text = toNumberedPlaceholders(sql);
    const result = this.pinned
      ? await this.pinned.query(text, params as SqlValue[])
      : await this.pool.query(text, params as SqlValue[]);
    return { rows: result.rows as unknown[], count: result.rowCount ?? 0 };
  }

  prepare(sql: string): PreparedStatement {
    return {
      run: async (...params: readonly SqlValue[]): Promise<StatementResult> => ({
        changes: (await this.run(sql, params)).count,
      }),
      get: async (...params: readonly SqlValue[]): Promise<unknown> =>
        (await this.run(sql, params)).rows[0],
      all: async (...params: readonly SqlValue[]): Promise<unknown[]> => (await this.run(sql, params)).rows,
    };
  }

  async exec(sql: string): Promise<void> {
    if (this.pinned) await this.pinned.query(sql);
    else await this.pool.query(sql);
  }

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    // Nested transactions are not a thing here: the one caller that opens one
    // (deleting a contest) does everything inside it, and pretending to support
    // savepoints would be inventing a capability nobody has asked for.
    if (this.pinned) return work();

    const client = await this.pool.connect();
    this.pinned = client;
    try {
      await client.query('BEGIN');
      const result = await work();
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      this.pinned = null;
      client.release();
    }
  }

  /**
   * A session-level advisory lock, held for the length of the migration run.
   *
   * The number is arbitrary but fixed — what matters is that every instance
   * asks for the *same* one. Taken on a pinned connection because an advisory
   * lock belongs to a session, and a pool would otherwise unlock it from a
   * different one.
   */
  async withMigrationLock<T>(work: () => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT pg_advisory_lock(4416337)');
      return await work();
    } finally {
      await client.query('SELECT pg_advisory_unlock(4416337)');
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
