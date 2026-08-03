import { describe, expect, it } from 'vitest';
import { HostAccount } from '@tapas/domain';
import { ListHostAccounts } from '../../../../src/auth/use-cases/list-host-accounts.js';
import type { HostAccountRepository } from '../../../../src/db/host-account-repository.js';

class FakeHostAccounts implements HostAccountRepository {
  constructor(private readonly accounts: HostAccount[]) {}
  async insert(): Promise<void> {}
  async update(): Promise<void> {}
  async findByEmail(): Promise<undefined> {
    return undefined;
  }
  async findById(): Promise<undefined> {
    return undefined;
  }
  async listAll(): Promise<HostAccount[]> {
    return this.accounts;
  }
}

describe('ListHostAccounts', async () => {
  it('lists every host account, saying which are administrators', async () => {
    const useCase = new ListHostAccounts({
      hostAccounts: new FakeHostAccounts([
        HostAccount.rehydrate('h1', 'ana@example.com', 'hash', 'admin', 0, null),
        HostAccount.rehydrate('h2', 'bob@example.com', 'hash', 'host', 0, null),
      ]),
    });

    expect(await useCase.execute()).toEqual([
      { email: 'ana@example.com', isAdministrator: true },
      { email: 'bob@example.com', isAdministrator: false },
    ]);
  });

  it('reveals no account-security state', async () => {
    const useCase = new ListHostAccounts({
      hostAccounts: new FakeHostAccounts([
        HostAccount.rehydrate('h1', 'ana@example.com', 'secret-hash', 'admin', 4, '2026-01-01T00:00:00.000Z'),
      ]),
    });

    const serialized = JSON.stringify(await useCase.execute());
    expect(serialized).not.toContain('secret-hash');
    expect(serialized).not.toContain('2026-01-01');
    expect(Object.keys((await useCase.execute())[0]!)).toEqual(['email', 'isAdministrator']);
  });

  it('lists nothing when there are no accounts', async () => {
    const useCase = new ListHostAccounts({ hostAccounts: new FakeHostAccounts([]) });
    expect(await useCase.execute()).toEqual([]);
  });
});
