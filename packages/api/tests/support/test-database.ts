import { DatabaseSync } from 'node:sqlite';
import { Client } from 'pg';
import type { Database } from '../../src/db/database.js';
import { PostgresDatabase } from '../../src/db/postgres-database.js';
import { SqliteDatabase } from '../../src/db/sqlite-database.js';
import { runMigrations } from '../../src/db/migrate.js';

/**
 * Which database the specs are running against.
 *
 * SQLite is the default because in-memory is what makes 2400-odd tests bearable
 * to run on every save. Postgres is asked for deliberately —
 * `TEST_DATABASE=postgres` — and is what shows the two are the same system,
 * which is the whole claim the driver strategy makes.
 */
const DRIVER = process.env.TEST_DATABASE === 'postgres' ? 'postgres' : 'sqlite';

const ADMIN_URL = process.env.TEST_DATABASE_URL ?? 'postgres://test:test@localhost:55432/tapas_test';

export function runningOnPostgres(): boolean {
  return DRIVER === 'postgres';
}

/**
 * One database per worker, migrated once.
 *
 * Vitest runs files in parallel workers, so a single shared Postgres database
 * would have them truncating each other's rows mid-test — a failure that looks
 * like a real bug and moves every run. A database per worker is the cheapest
 * isolation that survives that, and migrating it once rather than per spec is
 * what keeps the Postgres pass minutes rather than hours.
 */
let ready: Promise<{ database: Database; tables: string[] }> | null = null;

async function postgresForThisWorker(): Promise<{ database: Database; tables: string[] }> {
  const worker = process.env.VITEST_POOL_ID ?? process.env.VITEST_WORKER_ID ?? '1';
  const name = `tapas_test_w${worker}`;

  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  // Dropped and recreated so a worker never inherits the last run's rows — a
  // spec that passes only because of what an earlier run left behind is worse
  // than one that fails.
  await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();

  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  const database = new PostgresDatabase(url.toString());
  await runMigrations(database);

  const rows = (await database
    .prepare(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`)
    .all()) as Array<{ tablename: string }>;
  return { database, tables: rows.map((row) => row.tablename).filter((t) => t !== '_migrations') };
}

/**
 * A database with nothing in it, for one spec.
 *
 * On SQLite that is a new in-memory database, which costs nothing. On Postgres
 * it is the worker's database with every table emptied — creating one per spec
 * would spend the whole run on `CREATE DATABASE`.
 */
export async function freshDatabase(): Promise<{ database: Database; handle?: DatabaseSync }> {
  if (DRIVER === 'sqlite') {
    const handle = new DatabaseSync(':memory:');
    const database = new SqliteDatabase(handle);
    await runMigrations(database);
    return { database, handle };
  }

  ready ??= postgresForThisWorker();
  const { database, tables } = await ready;
  if (tables.length > 0) {
    await database.exec(`TRUNCATE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
  }
  return { database };
}
