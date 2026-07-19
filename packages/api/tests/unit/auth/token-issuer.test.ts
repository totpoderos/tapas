import { describe, expect, it } from 'vitest';
import { HmacJwtTokenIssuer, type Clock } from '../../../src/index.js';

const clock: Clock = { now: () => '2026-07-19T10:00:00.000Z' };
const SECRET = 'a-test-secret-that-is-32-plus-characters';

describe('HmacJwtTokenIssuer', () => {
  it('issues an access+refresh session and verifies its own access token', () => {
    const issuer = new HmacJwtTokenIssuer(SECRET, clock);
    const session = issuer.issue({ sub: 'host-1', role: 'host' });

    const claims = issuer.verify(session.accessToken);
    expect(claims?.sub).toBe('host-1');
    expect(claims?.role).toBe('host');
    expect(claims?.typ).toBe('access');
    expect(claims?.jti).toBe(session.sessionId);
  });

  it('shares one session id between the access and refresh token', () => {
    const issuer = new HmacJwtTokenIssuer(SECRET, clock);
    const session = issuer.issue({ sub: 'host-1', role: 'host' });

    expect(issuer.verify(session.refreshToken)?.jti).toBe(session.sessionId);
  });

  it('rejects a tampered token', () => {
    const issuer = new HmacJwtTokenIssuer(SECRET, clock);
    const token = issuer.issue({ sub: 'host-1', role: 'host' }).accessToken;
    const tampered = token.slice(0, -2) + (token.endsWith('a') ? 'bb' : 'aa');
    expect(issuer.verify(tampered)).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const signer = new HmacJwtTokenIssuer('secret-A-secret-A-secret-A-secret-A', clock);
    const verifier = new HmacJwtTokenIssuer('secret-B-secret-B-secret-B-secret-B', clock);
    expect(verifier.verify(signer.issue({ sub: 'x', role: 'host' }).accessToken)).toBeNull();
  });

  it('expires the access token but not the refresh token the next day', () => {
    const session = new HmacJwtTokenIssuer(SECRET, clock).issue({ sub: 'host-1', role: 'host' });
    const nextDay = new HmacJwtTokenIssuer(SECRET, { now: () => '2026-07-20T10:00:00.000Z' });

    expect(nextDay.verify(session.accessToken)).toBeNull(); // 15-minute access token has expired
    expect(nextDay.verify(session.refreshToken)?.sub).toBe('host-1'); // 7-day refresh token still valid
  });
});
