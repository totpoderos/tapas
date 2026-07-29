import { describe, expect, it } from 'vitest';
import { invitationHasExpired, INVITATION_LIFETIME_HOURS } from '../../src/auth/invitation-lifetime.js';

const ISSUED = '2026-07-29T10:00:00.000Z';

function laterBy(millis: number): string {
  return new Date(Date.parse(ISSUED) + millis).toISOString();
}

const ONE_DAY_MS = INVITATION_LIFETIME_HOURS * 60 * 60 * 1000;

describe('invitationHasExpired', () => {
  it('has not expired the moment it was issued', () => {
    expect(invitationHasExpired(ISSUED, ISSUED)).toBe(false);
  });

  it('has not expired a second before the window closes', () => {
    expect(invitationHasExpired(ISSUED, laterBy(ONE_DAY_MS - 1000))).toBe(false);
  });

  it('has expired at the instant the window closes', () => {
    expect(invitationHasExpired(ISSUED, laterBy(ONE_DAY_MS))).toBe(true);
  });

  it('has expired well after the window closes', () => {
    expect(invitationHasExpired(ISSUED, laterBy(ONE_DAY_MS * 30))).toBe(true);
  });

  it('is 24 hours', () => {
    expect(INVITATION_LIFETIME_HOURS).toBe(24);
  });
});
