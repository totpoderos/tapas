import type { HostAccount } from '@tapas/domain';
import type { HostAccountRepository, PasswordHasher, Session, SessionStore, TokenIssuer } from '../../../src/index.js';

export class FakeHostAccountRepository implements HostAccountRepository {
  private readonly byEmail = new Map<string, HostAccount>();
  insert(account: HostAccount): void {
    this.byEmail.set(account.email, account);
  }
  update(account: HostAccount): void {
    this.byEmail.set(account.email, account);
  }
  findByEmail(email: string): HostAccount | undefined {
    return this.byEmail.get(email);
  }
}

/** A fast, deterministic stand-in for bcrypt: `hashed:<raw>`. */
export class FakePasswordHasher implements PasswordHasher {
  async hash(raw: string): Promise<string> {
    return `hashed:${raw}`;
  }
  async verify(raw: string, hash: string): Promise<boolean> {
    return hash === `hashed:${raw}`;
  }
}

export class FakeTokenIssuer implements TokenIssuer {
  issue(): Session {
    return { accessToken: 'access-token', refreshToken: 'refresh-token', sessionId: 'session-1' };
  }
  verify(): null {
    return null;
  }
}

export class FakeSessionStore implements SessionStore {
  private readonly active = new Set<string>();
  activate(jti: string, _hostId: string, _expiresAt: string): void {
    this.active.add(jti);
  }
  revoke(jti: string): void {
    this.active.delete(jti);
  }
  isActive(jti: string): boolean {
    return this.active.has(jti);
  }
}
