import { describe, expect, it } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { requireHostSession } from '../../../src/http/require-host-session.js';
import { hashPatToken } from '../../../src/auth/pat-hasher.js';
import type { HostPatRepository } from '../../../src/db/host-pat-repository.js';
import type { StoredHostPat } from '../../../src/auth/stored-host-pat.js';
import type { SecurityEventInput, SecurityEventLog } from '../../../src/security/security-event.js';
import type { SessionStore, TokenIssuer, VerifiedClaims } from '../../../src/index.js';

const PAT_TOKEN = 'a-personal-access-token';

class FakePats implements HostPatRepository {
  constructor(private readonly pat?: StoredHostPat) {}
  async insert(): Promise<void> {}
  async findById(): Promise<StoredHostPat | undefined> {
    return this.pat;
  }
  async findByTokenHash(tokenHash: string): Promise<StoredHostPat | undefined> {
    return this.pat && this.pat.tokenHash === tokenHash ? this.pat : undefined;
  }
  async revoke(): Promise<void> {}
}

class RecordingSecurityLog implements SecurityEventLog {
  readonly recorded: SecurityEventInput[] = [];
  async record(event: SecurityEventInput): Promise<void> {
    this.recorded.push(event);
  }
  async list(): Promise<never[]> {
    return [];
  }
}

/** Verifies exactly one token string, so a test can hand out a "valid" cookie. */
class StubTokenIssuer implements TokenIssuer {
  constructor(private readonly claims: VerifiedClaims) {}
  issue(): never {
    throw new Error('not used');
  }
  verify(token: string): VerifiedClaims | null {
    return token === 'valid-access-token' ? this.claims : null;
  }
}

const ALWAYS_ACTIVE: SessionStore = {
  activate: async () => {},
  revoke: async () => {},
  isActive: async () => true,
};

function accessClaims(): VerifiedClaims {
  return { sub: 'host-1', role: 'host', typ: 'access', iat: 0, exp: 9_999_999_999, jti: 'jti-1' };
}

function makeReply(): { reply: FastifyReply; status: () => number | undefined } {
  let status: number | undefined;
  const stub = {
    code(next: number) {
      status = next;
      return stub;
    },
    async send() {
      return stub;
    },
  };
  return { reply: stub as unknown as FastifyReply, status: () => status };
}

function makeRequest(headers: Record<string, string>, cookies: Record<string, string>) {
  return { headers, cookies, ip: '127.0.0.1' } as unknown as FastifyRequest;
}

describe('requireHostSession', async () => {
  it('marks a cookie-borne request as authenticated by a session', async () => {
    const step = requireHostSession({
      tokens: new StubTokenIssuer(accessClaims()),
      sessions: ALWAYS_ACTIVE,
      pats: new FakePats(),
      securityLog: new RecordingSecurityLog(),
    });
    const request = makeRequest({}, { access_token: 'valid-access-token' });

    await step(request, makeReply().reply);

    expect(request.hostSession).toEqual({ id: 'host-1', authenticatedBy: 'session' });
  });

  it('marks a bearer-token request as authenticated by a personal access token', async () => {
    const pat: StoredHostPat = {
      id: 'pat-1',
      hostId: 'host-1',
      tokenHash: hashPatToken(PAT_TOKEN),
      createdAt: '2026-01-01T00:00:00.000Z',
      revokedAt: null,
    };
    const step = requireHostSession({
      tokens: new StubTokenIssuer(accessClaims()),
      sessions: ALWAYS_ACTIVE,
      pats: new FakePats(pat),
      securityLog: new RecordingSecurityLog(),
    });
    const request = makeRequest({ authorization: `Bearer ${PAT_TOKEN}` }, {});

    await step(request, makeReply().reply);

    expect(request.hostSession).toEqual({
      id: 'host-1',
      authenticatedBy: 'personal-access-token',
    });
  });

  it('refuses as not signed in when neither a cookie nor a token identifies anyone', async () => {
    const step = requireHostSession({
      tokens: new StubTokenIssuer(accessClaims()),
      sessions: ALWAYS_ACTIVE,
      pats: new FakePats(),
      securityLog: new RecordingSecurityLog(),
    });
    const request = makeRequest({}, {});
    const { reply, status } = makeReply();

    await step(request, reply);

    expect(status()).toBe(401);
    expect(request.hostSession).toBeUndefined();
  });
});
