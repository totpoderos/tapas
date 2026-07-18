import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

describe('runMigrations', () => {
  it('applies the initial migration and is idempotent', () => {
    const db = new DatabaseSync(':memory:');

    const first = runMigrations(db);
    expect(first).toContain('0001_init.sql');

    const second = runMigrations(db);
    expect(second).toEqual([]);

    const count = db.prepare('SELECT count(*) AS c FROM _migrations').get() as { c: number };
    expect(count.c).toBe(first.length);

    db.close();
  });
});
