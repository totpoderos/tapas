import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Database } from './database.js';
import { SqliteDatabase } from './sqlite-database.js';

const DEFAULT_MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');

/**
 * Opens the database a path names.
 *
 * Everything SQLite-specific that used to live here — the `PRAGMA` line — now
 * belongs to `SqliteDatabase`, because it is a property of a connection rather
 * than of a schema.
 */
export function openDatabase(path: string): Database {
  return new SqliteDatabase(path);
}

/**
 * Apply any not-yet-applied `*.sql` migrations in filename order, each in its
 * own transaction, recording applied names in `_migrations`. Idempotent:
 * running twice applies nothing the second time. Portable — the SQL avoids
 * constructs specific to either database.
 */
export async function runMigrations(
  db: Database,
  migrationsDir: string = DEFAULT_MIGRATIONS_DIR,
): Promise<string[]> {
  await db.exec(
    'CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);',
  );

  const applied = new Set(
    ((await db.prepare('SELECT name FROM _migrations').all()) as Array<{ name: string }>).map((r) => r.name),
  );

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const newlyApplied: string[] = [];
  const record = db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)');

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    /*
     * One transaction per migration, run through the database rather than by
     * saying BEGIN here — which database carries a transaction on which
     * connection is the adapter's business, and a migration that half-applied
     * would leave a schema no later migration could reason about.
     */
    await db.transaction(async () => {
      if (sql.trim().length > 0) await db.exec(sql);
      await record.run(file, new Date().toISOString());
    });
    newlyApplied.push(file);
  }

  return newlyApplied;
}

// CLI entry: `npm run migrate -w @tapas/api`
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const path = process.env.DATABASE_PATH ?? './tapas.sqlite';
  const db = openDatabase(path);
  const applied = await runMigrations(db);
  await db.close();
  console.log(applied.length ? `Applied ${applied.length} migration(s): ${applied.join(', ')}` : 'No pending migrations.');
}
