import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Database } from './database.js';

const DEFAULT_MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');

/**
 * Opens the database a path names.
 *
 * Everything SQLite-specific that used to live here — the `PRAGMA` line — now
 * belongs to `SqliteDatabase`, because it is a property of a connection rather
 * than of a schema.
 */
export async function openDatabase(path: string): Promise<Database> {
  const { SqliteDatabase } = await import('./sqlite-database.js');
  return new SqliteDatabase(path);
}

/**
 * The database a deployment's configuration asks for, loading only that one.
 *
 * Imported when chosen rather than at the top of the file, because the SQLite
 * adapter reaches for `node:sqlite` the moment it is loaded. A deployment that
 * has chosen Postgres — a serverless platform, say, whose runtime may not carry
 * that module at all — would otherwise fail on an import it was never going to
 * use.
 */
export async function openConfiguredDatabase(config: {
  readonly DATABASE_DRIVER: 'sqlite' | 'postgres';
  readonly DATABASE_PATH: string;
  readonly DATABASE_URL: string;
}): Promise<Database> {
  if (config.DATABASE_DRIVER === 'postgres') {
    const { PostgresDatabase } = await import('./postgres-database.js');
    return new PostgresDatabase(config.DATABASE_URL);
  }
  const { SqliteDatabase } = await import('./sqlite-database.js');
  return new SqliteDatabase(config.DATABASE_PATH);
}

/**
 * Apply any not-yet-applied `*.sql` migrations in filename order, each in its
 * own transaction, recording applied names in `_migrations`. Idempotent:
 * running twice applies nothing the second time. Portable — the SQL avoids
 * constructs specific to either database.
 */
/** One migration, named and in full — the same thing a `.sql` file holds. */
export interface Migration {
  readonly name: string;
  readonly sql: string;
}

/**
 * Reads them off disk, which is what a long-lived process does.
 *
 * A serverless function has no `migrations` directory to read: it is one
 * bundled file, and the .sql files are not in the deployment at all. That
 * caller hands the migrations in instead — see the overload above.
 */
function migrationsIn(dir: string): Migration[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8') }));
}

export async function runMigrations(
  db: Database,
  from: string | readonly Migration[] = DEFAULT_MIGRATIONS_DIR,
): Promise<string[]> {
  const migrations = typeof from === 'string' ? migrationsIn(from) : from;
  // One instance applies them; the rest wait and find nothing to do. A database
  // that cannot have two instances does not offer the lock, and does not need to.
  const apply = () => applyPending(db, migrations);
  return db.withMigrationLock ? db.withMigrationLock(apply) : apply();
}

async function applyPending(db: Database, migrations: readonly Migration[]): Promise<string[]> {
  await db.exec(
    'CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);',
  );

  const applied = new Set(
    ((await db.prepare('SELECT name FROM _migrations').all()) as Array<{ name: string }>).map((r) => r.name),
  );

  const newlyApplied: string[] = [];
  const record = db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)');

  for (const { name, sql } of migrations) {
    if (applied.has(name)) continue;
    /*
     * One transaction per migration, run through the database rather than by
     * saying BEGIN here — which database carries a transaction on which
     * connection is the adapter's business, and a migration that half-applied
     * would leave a schema no later migration could reason about.
     */
    await db.transaction(async () => {
      if (sql.trim().length > 0) await db.exec(sql);
      await record.run(name, new Date().toISOString());
    });
    newlyApplied.push(name);
  }

  return newlyApplied;
}

// CLI entry: `npm run migrate -w @tapas/api`
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const path = process.env.DATABASE_PATH ?? './tapas.sqlite';
  const db = await openDatabase(path);
  const applied = await runMigrations(db);
  await db.close();
  console.log(applied.length ? `Applied ${applied.length} migration(s): ${applied.join(', ')}` : 'No pending migrations.');
}
