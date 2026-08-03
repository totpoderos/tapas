import { describe, expect, it } from 'vitest';
import { HmacJwtTokenIssuer, RefreshSession, type Clock } from '../../../../src/index.js';
import { FakeSessionStore } from '../support.js';

const SECRET = 'a-test-secret-that-is-32-plus-characters';

function makeRefreshEnv(clock: Clock) {
  const tokens = new HmacJwtTokenIssuer(SECRET, clock);
  const sessions = new FakeSessionStore();
  return { refreshSession: new RefreshSession({ tokens, sessions, clock }), tokens, sessions };
}

describe('RefreshSession', async () => {
  it('rotates an active refresh token for a fresh, activated session', async () => {
    const clock: Clock = { now: () => '2026-07-19T10:00:00.000Z' };
    const { refreshSession, tokens, sessions } = makeRefreshEnv(clock);
    const original = tokens.issue({ sub: 'host-1', role: 'host' });
    await sessions.activate(original.sessionId, 'host-1', '2026-07-26T10:00:00.000Z');

    const refreshOutcome = await refreshSession.execute(original.refreshToken);

    expect(refreshOutcome.ok).toBe(true);
    if (refreshOutcome.ok) expect(await sessions.isActive(refreshOutcome.session.sessionId)).toBe(true);
    expect(await sessions.isActive(original.sessionId)).toBe(false);
  });

  it('refuses a refresh token whose session was already revoked', async () => {
    const clock: Clock = { now: () => '2026-07-19T10:00:00.000Z' };
    const { refreshSession, tokens, sessions } = makeRefreshEnv(clock);
    const original = tokens.issue({ sub: 'host-1', role: 'host' });
    await sessions.activate(original.sessionId, 'host-1', '2026-07-26T10:00:00.000Z');
    await sessions.revoke(original.sessionId);

    const refreshOutcome = await refreshSession.execute(original.refreshToken);

    expect(refreshOutcome.ok).toBe(false);
    if (!refreshOutcome.ok) expect(refreshOutcome.error.code).toBe('NOT_SIGNED_IN');
  });

  it('refuses an access token presented as a refresh token', async () => {
    const clock: Clock = { now: () => '2026-07-19T10:00:00.000Z' };
    const { refreshSession, tokens, sessions } = makeRefreshEnv(clock);
    const original = tokens.issue({ sub: 'host-1', role: 'host' });
    await sessions.activate(original.sessionId, 'host-1', '2026-07-26T10:00:00.000Z');

    const refreshOutcome = await refreshSession.execute(original.accessToken);

    expect(refreshOutcome.ok).toBe(false);
    if (!refreshOutcome.ok) expect(refreshOutcome.error.code).toBe('NOT_SIGNED_IN');
  });

  it('rejects an expired refresh token', async () => {
    const issuedAt: Clock = { now: () => '2026-07-19T10:00:00.000Z' };
    const { tokens, sessions } = makeRefreshEnv(issuedAt);
    const original = tokens.issue({ sub: 'host-1', role: 'host' });
    await sessions.activate(original.sessionId, 'host-1', '2026-07-26T10:00:00.000Z');

    const aWeekLater: Clock = { now: () => '2026-07-27T10:00:00.000Z' };
    const tokensLater = new HmacJwtTokenIssuer(SECRET, aWeekLater);
    const refreshOutcome = await new RefreshSession({ tokens: tokensLater, sessions, clock: aWeekLater }).execute(
      original.refreshToken,
    );

    expect(refreshOutcome.ok).toBe(false);
    if (!refreshOutcome.ok) expect(refreshOutcome.error.code).toBe('NOT_SIGNED_IN');
  });
});
