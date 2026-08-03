import { DatabaseSync } from 'node:sqlite';
import { SqliteDatabase } from '../../../src/db/sqlite-database.js';
import { describe, expect, it } from 'vitest';
import { runMigrations } from '../../../src/db/migrate.js';

describe('runMigrations', async () => {
  it('applies the initial migration and is idempotent', async () => {
    const db = new DatabaseSync(':memory:');

    const first = await runMigrations(new SqliteDatabase(db));
    expect(first).toContain('0001_init.sql');

    const second = await runMigrations(new SqliteDatabase(db));
    expect(second).toEqual([]);

    const count = db.prepare('SELECT count(*) AS c FROM _migrations').get() as { c: number };
    expect(count.c).toBe(first.length);

    db.close();
  });
});
