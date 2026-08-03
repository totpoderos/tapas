import { Email } from '@tapas/domain';
import type { Clock } from '../../audit/audit-projection.js';
import type { HostAccountRepository } from '../../db/host-account-repository.js';
import type { PasswordHasher } from '../password-hasher.js';
import type { SessionStore } from '../session-store.js';
import { REFRESH_TTL_SECONDS, type TokenIssuer } from '../token-issuer.js';
import type { AuthLogReason, AuthResult } from './shared.js';

export interface AuthenticateHostDeps {
  readonly accounts: HostAccountRepository;
  readonly hasher: PasswordHasher;
  readonly tokens: TokenIssuer;
  readonly sessions: SessionStore;
  readonly clock: Clock;
}

// Same generic failure for a wrong password and an unknown email — no enumeration (A07/A04).
// The internal `logReason`/`hostId` are for the security log only, never sent to the caller.
function invalidCredentials(logReason: AuthLogReason, hostId: string | null): AuthResult {
  return {
    ok: false,
    error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
    logReason,
    hostId,
  };
}

/** Authenticates a host, honouring account lockout, and issues a session on success. */
export class AuthenticateHost {
  constructor(private readonly deps: AuthenticateHostDeps) {}

  async execute(rawEmail: string, rawPassword: string): Promise<AuthResult> {
    const emailResult = Email.create(rawEmail);
    if (!emailResult.ok) return invalidCredentials('unknown_account', null);

    const account = await this.deps.accounts.findByEmail(emailResult.email.value);
    if (!account) return invalidCredentials('unknown_account', null);

    const now = this.deps.clock.now();
    if (account.isLocked(now)) {
      return {
        ok: false,
        error: { code: 'ACCOUNT_LOCKED', message: 'Account temporarily locked. Try again later.' },
        logReason: 'account_locked',
        hostId: account.id,
      };
    }

    const correct = await this.deps.hasher.verify(rawPassword, account.passwordHash);
    if (!correct) {
      await this.deps.accounts.update(account.withFailedLogin(now));
      return invalidCredentials('bad_password', account.id);
    }

    await this.deps.accounts.update(account.withSuccessfulLogin());
    const session = this.deps.tokens.issue({ sub: account.id, role: account.role });
    const expiresAt = new Date(Date.parse(now) + REFRESH_TTL_SECONDS * 1000).toISOString();
    await this.deps.sessions.activate(session.sessionId, account.id, expiresAt);
    return { ok: true, session, hostId: account.id, role: account.role };
  }
}
