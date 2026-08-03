import type { HostAccount } from '@tapas/domain';
import type { HostAccountRepository, PasswordHasher, Session, SessionStore, TokenIssuer } from '../../../src/index.js';

export class FakeHostAccountRepository implements HostAccountRepository {
  private readonly byEmail = new Map<string, HostAccount>();
  async insert(account: HostAccount): Promise<void> {
    this.byEmail.set(account.email, account);
  }
  async update(account: HostAccount): Promise<void> {
    this.byEmail.set(account.email, account);
  }
  async findByEmail(email: string): Promise<HostAccount | undefined> {
    return this.byEmail.get(email);
  }
  async findById(id: string): Promise<HostAccount | undefined> {
    return [...this.byEmail.values()].find((account) => account.id === id);
  }
  async listAll(): Promise<HostAccount[]> {
    return [...this.byEmail.values()];
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
  async activate(jti: string, _hostId: string, _expiresAt: string): Promise<void> {
    this.active.add(jti);
  }
  async revoke(jti: string): Promise<void> {
    this.active.delete(jti);
  }
  async isActive(jti: string): Promise<boolean> {
    return this.active.has(jti);
  }
}
