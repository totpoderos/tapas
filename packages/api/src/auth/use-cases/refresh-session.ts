import type { Clock } from '../../audit/audit-projection.js';
import type { SessionStore } from '../session-store.js';
import { REFRESH_TTL_SECONDS, type TokenIssuer } from '../token-issuer.js';
import type { RefreshResult } from './shared.js';

export interface RefreshSessionDeps {
  readonly tokens: TokenIssuer;
  readonly sessions: SessionStore;
  readonly clock: Clock;
}

const notSignedIn: RefreshResult = {
  ok: false,
  error: { code: 'NOT_SIGNED_IN', message: 'Sign in required.' },
};

/** Rotates a refresh token: the presented one is revoked outright and a fresh session takes its place. */
export class RefreshSession {
  constructor(private readonly deps: RefreshSessionDeps) {}

  execute(refreshToken: string): RefreshResult {
    const claims = this.deps.tokens.verify(refreshToken);
    if (!claims || claims.typ !== 'refresh' || !this.deps.sessions.isActive(claims.jti)) return notSignedIn;

    this.deps.sessions.revoke(claims.jti);

    const session = this.deps.tokens.issue({ sub: claims.sub, role: claims.role });
    const expiresAt = new Date(Date.parse(this.deps.clock.now()) + REFRESH_TTL_SECONDS * 1000).toISOString();
    this.deps.sessions.activate(session.sessionId, claims.sub, expiresAt);

    return { ok: true, session, hostId: claims.sub, role: claims.role };
  }
}
