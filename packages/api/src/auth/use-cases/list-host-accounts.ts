import type { HostAccountRepository } from '../../db/host-account-repository.js';

/**
 * What an administrator is shown about a host account. Deliberately narrow:
 * a password hash, a lock, and a failed-attempt count are that account's own
 * security state, and an administrator has no need of them.
 */
export interface HostAccountSummary {
  readonly email: string;
  readonly isAdministrator: boolean;
}

export interface ListHostAccountsDeps {
  readonly hostAccounts: HostAccountRepository;
}

/** Lists every host account for an administrator — the first administrative work there is. */
export class ListHostAccounts {
  constructor(private readonly deps: ListHostAccountsDeps) {}

  async execute(): Promise<HostAccountSummary[]> {
    return (await this.deps.hostAccounts
      .listAll())
      .map((account) => ({ email: account.email, isAdministrator: account.role === 'admin' }));
  }
}
