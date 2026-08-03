import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SqliteDatabase } from '../../../src/db/sqlite-database.js';
import { runMigrations } from '../../../src/db/migrate.js';

describe('runMigrations', async () => {
  it('applies the initial migration and is idempotent', async () => {
    /*
     * Its own empty database, not the shared harness's: this is about the
     * runner's own bookkeeping — what it applies and what it declines to apply
     * twice — and the harness hands back a database already migrated, which is
     * the one starting state that cannot show it.
     */
    const database = new SqliteDatabase(new DatabaseSync(':memory:'));

    const first = await runMigrations(database);
    expect(first).toContain('0001_init.sql');

    const second = await runMigrations(database);
    expect(second).toEqual([]);

    const count = await database.prepare('SELECT count(*) AS c FROM _migrations').get() as { c: number };
    expect(count.c).toBe(first.length);

    database.close();
  });
});
