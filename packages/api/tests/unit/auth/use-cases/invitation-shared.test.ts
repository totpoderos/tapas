import { describe, expect, it } from 'vitest';
import { usabilityOf } from '../../../../src/auth/use-cases/invitation-shared.js';
import type { StoredInvitation } from '../../../../src/db/host-invitation-repository.js';

const ISSUED_AT = '2026-07-29T10:00:00.000Z';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function laterBy(millis: number): string {
  return new Date(Date.parse(ISSUED_AT) + millis).toISOString();
}

const PENDING: StoredInvitation = {
  id: 'inv-1',
  email: 'nuevo@example.com',
  tokenHash: 'the-hash',
  status: 'pending',
  issuedBy: 'admin-1',
  issuedAt: ISSUED_AT,
  acceptedAt: null,
};

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

  it('reports an accepted invitation as accepted rather than expired', () => {
    // Both are true of it; which one an auditor is told matters.
    const accepted = { ...PENDING, status: 'accepted' as const, acceptedAt: laterBy(1000) };

    expect(usabilityOf(accepted, laterBy(ONE_DAY_MS * 2))).toEqual({
      usable: false,
      reason: 'already_accepted',
    });
  });
});
