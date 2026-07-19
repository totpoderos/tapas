import { checkPasswordStrength, Email, HostAccount } from '@tapas/domain';
import type { IdGenerator } from '../../audit/audit-projection.js';
import type { HostAccountRepository } from '../../db/host-account-repository.js';
import type { PasswordHasher } from '../password-hasher.js';
import type { RegisterResult } from './shared.js';

export interface RegisterHostDeps {
  readonly accounts: HostAccountRepository;
  readonly hasher: PasswordHasher;
  readonly ids: IdGenerator;
}

/** Registers a host: validates the email + password policy, then stores a hashed credential. */
export class RegisterHost {
  constructor(private readonly deps: RegisterHostDeps) {}

  async execute(rawEmail: string, rawPassword: string): Promise<RegisterResult> {
    const emailResult = Email.create(rawEmail);
    if (!emailResult.ok) return { ok: false, error: { code: 'INVALID_EMAIL', message: emailResult.error.message } };

    if (checkPasswordStrength(rawPassword) !== null) {
      return { ok: false, error: { code: 'WEAK_PASSWORD', message: 'Password does not meet the policy.' } };
    }

    const email = emailResult.email.value;
    if (this.deps.accounts.findByEmail(email)) {
      return { ok: false, error: { code: 'EMAIL_TAKEN', message: 'That email is already registered.' } };
    }

    const passwordHash = await this.deps.hasher.hash(rawPassword);
    const account = HostAccount.register(this.deps.ids.next(), email, passwordHash);
    this.deps.accounts.insert(account);
    return { ok: true, hostId: account.id };
  }
}
