import type { Database } from '../../../src/db/database.js';
import { freshDatabase } from '../../support/test-database.js';
import { beforeEach, describe, expect, it } from 'vitest';
import { HostAccount } from '@tapas/domain';
import { SqliteHostAccountRepository } from '../../../src/db/host-account-repository.js';

/**
 * The one-administrator guarantee is the database's, not a check in code. A
 * read-then-write could be interleaved by a second request; a unique index
 * cannot be.
 */
describe('a deployment has at most one administrator', async () => {
  let database: Database;
  let accounts: SqliteHostAccountRepository;

  beforeEach(async () => {
    ({ database } = await freshDatabase());
    accounts = new SqliteHostAccountRepository(database);
  });

  it('accepts the first administrator', async () => {
    await expect(accounts.insert(HostAccount.register('a1', 'one@example.com', 'hash', 'admin'))).resolves.not.toThrow();
  });

  it('refuses a second administrator', async () => {
    await accounts.insert(HostAccount.register('a1', 'one@example.com', 'hash', 'admin'));

    await expect(accounts.insert(HostAccount.register('a2', 'two@example.com', 'hash', 'admin'))).rejects.toThrow();
  });

  it('places no such limit on ordinary hosts', async () => {
    await accounts.insert(HostAccount.register('h1', 'one@example.com', 'hash'));
    await accounts.insert(HostAccount.register('h2', 'two@example.com', 'hash'));
    await accounts.insert(HostAccount.register('h3', 'three@example.com', 'hash'));

    expect(await accounts.listAll()).toHaveLength(3);
  });

  it('allows an administrator alongside any number of hosts', async () => {
    await accounts.insert(HostAccount.register('a1', 'admin@example.com', 'hash', 'admin'));
    await accounts.insert(HostAccount.register('h1', 'one@example.com', 'hash'));

    expect((await accounts.listAll()).filter((account) => account.role === 'admin')).toHaveLength(1);
  });
});
