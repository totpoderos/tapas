import { DatabaseSync } from 'node:sqlite';
import type { Database, PreparedStatement, SqlValue, StatementResult } from './database.js';

/**
 * The `Database` served by SQLite on a local disk (or in memory, which is what
 * the whole test suite runs on).
 *
 * Every method answers a promise that is already resolved. Nothing here waits
 * for anything — `node:sqlite` is synchronous — and that is exactly the point:
 * the callers get one shape whichever database they are on, and the fast
 * database stays fast rather than being slowed to look like the slow one.
 *
 * This is also where everything SQLite-only now lives. The `PRAGMA` line that
 * used to sit in `openDatabase` is the only such thing in the project, and it
 * belongs to a connection, not to a schema.
 */
export class SqliteDatabase implements Database {
  private readonly db: DatabaseSync;

  /**
   * Takes a path to open, or a connection already open.
   *
   * The second form is what lets a test seed and inspect the same in-memory
   * database the app is using: `:memory:` opened twice is two databases, so a
   * harness that opened its own would be looking at somewhere else entirely.
   */
  constructor(pathOrConnection: string | DatabaseSync) {
    this.db =
      typeof pathOrConnection === 'string' ? new DatabaseSync(pathOrConnection) : pathOrConnection;
    // WAL so a reader never blocks a writer; foreign keys because SQLite does
    // not enforce them unless asked, and the schema declares them.
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  }

  prepare(sql: string): PreparedStatement {
    const statement = this.db.prepare(sql);
    return {
      async run(...params: readonly SqlValue[]): Promise<StatementResult> {
        const result = statement.run(...(params as SqlValue[]));
        return { changes: Number(result.changes) };
      },
      async get(...params: readonly SqlValue[]): Promise<unknown> {
        return statement.get(...(params as SqlValue[]));
      },
      async all(...params: readonly SqlValue[]): Promise<unknown[]> {
        return statement.all(...(params as SqlValue[]));
      },
    };
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  /**
   * Deleting a contest is the reason transactions exist here: it spans five
   * tables plus the audit log, none of which cascade, and a failure part-way
   * through would leave a contest whose votes were destroyed but whose row
   * survived — or a history erased with no tombstone in its place. Either
   * half-state is unrecoverable, so the whole thing commits or none of it does.
   */
  async transaction<T>(work: () => Promise<T>): Promise<T> {
    this.db.exec('BEGIN;');
    try {
      const result = await work();
      this.db.exec('COMMIT;');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
