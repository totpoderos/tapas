import { describe, expect, it } from 'vitest';
import { usabilityOf } from '../../../../src/auth/use-cases/invitation-shared.js';
import type { StoredInvitation } from '../../../../src/db/host-invitation-repository.js';
import { pendingInvitation } from './invitation-support.js';

const ISSUED_AT = '2026-07-29T10:00:00.000Z';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function laterBy(millis: number): string {
  return new Date(Date.parse(ISSUED_AT) + millis).toISOString();
}

const PENDING: StoredInvitation = pendingInvitation({ issuedAt: ISSUED_AT });

describe('usabilityOf', () => {
  it('is usable while pending and in time', () => {
    expect(usabilityOf(PENDING, laterBy(ONE_DAY_MS - 1000))).toEqual({
      usable: true,
      invitation: PENDING,
    });
  });

  it('is unusable when there is no such invitation', () => {
    expect(usabilityOf(undefined, ISSUED_AT)).toEqual({ usable: false, reason: 'unknown' });
  });

  it('is unusable once accepted, even well within the window', () => {
    const accepted = { ...PENDING, status: 'accepted' as const, acceptedAt: laterBy(1000) };

    expect(usabilityOf(accepted, laterBy(2000))).toEqual({
      usable: false,
      reason: 'already_accepted',
    });
  });

  it('is unusable once the window has closed', () => {
    expect(usabilityOf(PENDING, laterBy(ONE_DAY_MS))).toEqual({ usable: false, reason: 'expired' });
  });

  it('is unusable once revoked, even well within the window', () => {
    const revoked = { ...PENDING, status: 'revoked' as const, revokedAt: laterBy(1000) };

    expect(usabilityOf(revoked, laterBy(2000))).toEqual({ usable: false, reason: 'revoked' });
  });

  it('is unusable once superseded by a resend', () => {
    const superseded = { ...PENDING, status: 'superseded' as const, supersededBy: 'inv-2' };

    expect(usabilityOf(superseded, laterBy(2000))).toEqual({
      usable: false,
      reason: 'superseded',
    });
  });

  it('gives all five reasons distinctly — the log needs them apart', () => {
    const at = laterBy(2000);
    const reasons = [
      usabilityOf(undefined, at),
      usabilityOf({ ...PENDING, status: 'accepted', acceptedAt: laterBy(1000) }, at),
      usabilityOf(PENDING, laterBy(ONE_DAY_MS)),
      usabilityOf({ ...PENDING, status: 'revoked', revokedAt: laterBy(1000) }, at),
      usabilityOf({ ...PENDING, status: 'superseded', supersededBy: 'inv-2' }, at),
    ].map((usability) => (usability.usable ? 'usable' : usability.reason));

    expect(reasons).toEqual([
      'unknown',
      'already_accepted',
      'expired',
      'revoked',
      'superseded',
    ]);
    expect(new Set(reasons).size).toBe(5);
  });

  it('reports an accepted invitation as accepted rather than expired', () => {
    // Both are true of it; which one an auditor is told matters.
    const accepted = { ...PENDING, status: 'accepted' as const, acceptedAt: laterBy(1000) };

    expect(usabilityOf(accepted, laterBy(ONE_DAY_MS * 2))).toEqual({
      usable: false,
      reason: 'already_accepted',
    });
  });
});
