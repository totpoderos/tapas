export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_DURATION_MINUTES = 15;

export type HostRole = 'host' | 'admin';

/**
 * A host's account and its login-security state. Owns the lockout invariant:
 * after {@link MAX_FAILED_ATTEMPTS} failures the account is locked for
 * {@link LOCK_DURATION_MINUTES}. Immutable — state transitions return a new
 * instance. The current time is passed in (the domain has no clock); password
 * hashing lives outside the domain.
 */
export class HostAccount {
  private constructor(
    readonly id: string,
    readonly email: string,
    readonly passwordHash: string,
    readonly role: HostRole,
    readonly failedAttempts: number,
    readonly lockedUntil: string | null,
  ) {}

  static register(
    id: string,
    email: string,
    passwordHash: string,
    role: HostRole = 'host',
  ): HostAccount {
    return new HostAccount(id, email, passwordHash, role, 0, null);
  }

  static rehydrate(
    id: string,
    email: string,
    passwordHash: string,
    role: HostRole,
    failedAttempts: number,
    lockedUntil: string | null,
  ): HostAccount {
    return new HostAccount(id, email, passwordHash, role, failedAttempts, lockedUntil);
  }

  isLocked(nowIso: string): boolean {
    return this.lockedUntil !== null && Date.parse(nowIso) < Date.parse(this.lockedUntil);
  }

  withFailedLogin(nowIso: string): HostAccount {
    const attempts = this.failedAttempts + 1;
    const lockedUntil =
      attempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.parse(nowIso) + LOCK_DURATION_MINUTES * 60_000).toISOString()
        : this.lockedUntil;
    return new HostAccount(this.id, this.email, this.passwordHash, this.role, attempts, lockedUntil);
  }

  withSuccessfulLogin(): HostAccount {
    return new HostAccount(this.id, this.email, this.passwordHash, this.role, 0, null);
  }
}
