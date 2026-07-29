import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { HostAccount } from '@tapas/domain';
import { runMigrations } from '../../../src/db/migrate.js';
import { SqliteHostAccountRepository } from '../../../src/db/host-account-repository.js';

/**
 * The one-administrator guarantee is the database's, not a check in code. A
 * read-then-write could be interleaved by a second request; a unique index
 * cannot be.
 */
describe('a deployment has at most one administrator', () => {
  let db: DatabaseSync;
  let accounts: SqliteHostAccountRepository;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    runMigrations(db);
    accounts = new SqliteHostAccountRepository(db);
  });

  it('accepts the first administrator', () => {
    expect(() =>
      accounts.insert(HostAccount.register('a1', 'one@example.com', 'hash', 'admin')),
    ).not.toThrow();
  });

  it('refuses a second administrator', () => {
    accounts.insert(HostAccount.register('a1', 'one@example.com', 'hash', 'admin'));

    expect(() =>
      accounts.insert(HostAccount.register('a2', 'two@example.com', 'hash', 'admin')),
    ).toThrow();
  });

  it('places no such limit on ordinary hosts', () => {
    accounts.insert(HostAccount.register('h1', 'one@example.com', 'hash'));
    accounts.insert(HostAccount.register('h2', 'two@example.com', 'hash'));
    accounts.insert(HostAccount.register('h3', 'three@example.com', 'hash'));

    expect(accounts.listAll()).toHaveLength(3);
  });

  it('allows an administrator alongside any number of hosts', () => {
    accounts.insert(HostAccount.register('a1', 'admin@example.com', 'hash', 'admin'));
    accounts.insert(HostAccount.register('h1', 'one@example.com', 'hash'));

    expect(accounts.listAll().filter((account) => account.role === 'admin')).toHaveLength(1);
  });
});
