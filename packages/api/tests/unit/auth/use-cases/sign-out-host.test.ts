import { describe, expect, it } from 'vitest';
import { HmacJwtTokenIssuer, SignOutHost, type Clock } from '../../../../src/index.js';
import { FakeSessionStore } from '../support.js';

const SECRET = 'a-test-secret-that-is-32-plus-characters';
const clock: Clock = { now: () => '2026-07-19T10:00:00.000Z' };

describe('SignOutHost', async () => {
  it('revokes the session behind a valid token', async () => {
    const tokens = new HmacJwtTokenIssuer(SECRET, clock);
    const sessions = new FakeSessionStore();
    const session = tokens.issue({ sub: 'host-1', role: 'host' });
    await sessions.activate(session.sessionId, 'host-1', '2026-07-26T10:00:00.000Z');

    await new SignOutHost({ tokens, sessions }).execute(session.refreshToken);

    expect(await sessions.isActive(session.sessionId)).toBe(false);
  });

  it('is a no-op when no token is presented', async () => {
    const tokens = new HmacJwtTokenIssuer(SECRET, clock);
    const sessions = new FakeSessionStore();

    await expect(new SignOutHost({ tokens, sessions }).execute(undefined)).resolves.not.toThrow();
  });
});
