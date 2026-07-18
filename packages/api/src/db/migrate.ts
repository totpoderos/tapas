import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');

export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  return db;
}

/**
 * Apply any not-yet-applied `*.sql` migrations in filename order, each in its
 * own transaction, recording applied names in `_migrations`. Idempotent:
 * running twice applies nothing the second time. Postgres-ready — the SQL
 * avoids SQLite-only constructs.
 */
export function runMigrations(db: DatabaseSync, migrationsDir: string = DEFAULT_MIGRATIONS_DIR): string[] {
  db.exec(
    'CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);',
  );

  const applied = new Set(
    (db.prepare('SELECT name FROM _migrations').all() as Array<{ name: string }>).map((r) => r.name),
  );

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const newlyApplied: string[] = [];
  const record = db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)');

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    db.exec('BEGIN;');
    try {
      if (sql.trim().length > 0) db.exec(sql);
      record.run(file, new Date().toISOString());
      db.exec('COMMIT;');
    } catch (error) {
      db.exec('ROLLBACK;');
      throw error;
    }
    newlyApplied.push(file);
  }

  return newlyApplied;
}

// CLI entry: `npm run migrate -w @tapas/api`
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const path = process.env.DATABASE_PATH ?? './tapas.sqlite';
  const db = openDatabase(path);
  const applied = runMigrations(db);
  db.close();
  console.log(applied.length ? `Applied ${applied.length} migration(s): ${applied.join(', ')}` : 'No pending migrations.');
}
