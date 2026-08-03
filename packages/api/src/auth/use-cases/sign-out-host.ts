import type { SessionStore } from '../session-store.js';
import type { TokenIssuer } from '../token-issuer.js';

export interface SignOutHostDeps {
  readonly tokens: TokenIssuer;
  readonly sessions: SessionStore;
}

/** Ends a session outright. Idempotent: an already-invalid token is simply a no-op. */
export class SignOutHost {
  constructor(private readonly deps: SignOutHostDeps) {}

  async execute(token: string | undefined): Promise<void> {
    if (!token) return;
    const claims = this.deps.tokens.verify(token);
    if (claims) await this.deps.sessions.revoke(claims.jti);
  }
}
