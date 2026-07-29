import type { LightMyRequestResponse } from 'fastify';
import { describe, expect, it } from 'vitest';
import { invitationSentTo } from '../support/invitations.js';
import { MutableClock, type TestApp } from '../support/test-server.js';

const STRONG_PASSWORD = 'Str0ng!Passw0rd';
const ISSUED_AT = '2026-07-29T10:00:00.000Z';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The acceptance feature checks each refusal against the unknown-link one. This
 * pins the consequence that matters: all five are identical to *each other*, so
 * nobody holding a link that does not work can tell which of the five reasons
 * applied — including whether an invitation for that address ever existed.
 */
describe('every reason a link does not work looks the same', () => {
  it('answers identically for unknown, accepted, expired, revoked and superseded', async () => {
    const accept = (test: TestApp, token: string): Promise<LightMyRequestResponse> =>
      test.app.inject({
        method: 'POST',
        url: `/invites/${token}/accept`,
        payload: { password: STRONG_PASSWORD },
      });

    // Unknown
    const base = await invitationSentTo('nuevo@example.com');
    const unknown = await accept(base.test, 'a-token-nobody-ever-issued');

    // Already accepted
    const used = await invitationSentTo('used@example.com');
    await accept(used.test, used.token);
    const alreadyAccepted = await accept(used.test, used.token);

    // Expired
    const clock = new MutableClock(ISSUED_AT);
    const stale = await invitationSentTo('stale@example.com', clock);
    clock.advance(ONE_DAY_MS + 1000);
    const expired = await accept(stale.test, stale.token);

    // Revoked
    const cancelled = await invitationSentTo('cancelled@example.com');
    await cancelled.test.app.inject({
      method: 'POST',
      url: `/admin/invites/${cancelled.id}/revoke`,
      headers: { cookie: cancelled.adminCookie },
    });
    const revoked = await accept(cancelled.test, cancelled.token);

    // Superseded
    const replaced = await invitationSentTo('replaced@example.com');
    await replaced.test.app.inject({
      method: 'POST',
      url: `/admin/invites/${replaced.id}/resend`,
      headers: { cookie: replaced.adminCookie },
    });
    const superseded = await accept(replaced.test, replaced.token);

    const refusals = [unknown, alreadyAccepted, expired, revoked, superseded];
    for (const refusal of refusals) expect(refusal.statusCode).toBe(404);

    expect(new Set(refusals.map((refusal) => refusal.statusCode)).size).toBe(1);
    expect(new Set(refusals.map((refusal) => refusal.body)).size).toBe(1);
    for (const refusal of refusals) expect(refusal.body).not.toContain('@');
  });
});
