import { describe, expect, it } from 'vitest';
import { RevokeInvitation } from '../../../../src/auth/use-cases/revoke-invitation.js';
import { FakeInvitationRepository, pendingInvitation } from './invitation-support.js';

const ISSUED_AT = '2026-07-29T10:00:00.000Z';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function laterBy(millis: number): string {
  return new Date(Date.parse(ISSUED_AT) + millis).toISOString();
}

function makeUseCase(overrides = {}, nowIso = laterBy(1000)) {
  const invitations = new FakeInvitationRepository();
  invitations.insert(pendingInvitation(overrides));
  return {
    invitations,
    useCase: new RevokeInvitation({ invitations, clock: { now: () => nowIso } }),
  };
}

describe('RevokeInvitation', () => {
  it('revokes a live invitation', () => {
    const { useCase, invitations } = makeUseCase();

    expect(useCase.execute('inv-1')).toEqual({ ok: true });
    expect(invitations.stored[0]).toMatchObject({
      status: 'revoked',
      revokedAt: laterBy(1000),
    });
  });

  it('refuses an invitation nobody issued', () => {
    const { useCase } = makeUseCase();

    expect(useCase.execute('inv-nobody-issued')).toMatchObject({
      ok: false,
      error: { code: 'INVITATION_NOT_FOUND' },
    });
  });

  it('refuses one already accepted — there is nothing to revoke', () => {
    const { useCase } = makeUseCase({ status: 'accepted', acceptedAt: laterBy(500) });

    expect(useCase.execute('inv-1')).toMatchObject({
      ok: false,
      error: { code: 'NOTHING_TO_REVOKE' },
    });
  });

  it('refuses one already revoked', () => {
    const { useCase } = makeUseCase({ status: 'revoked', revokedAt: laterBy(500) });

    expect(useCase.execute('inv-1')).toMatchObject({
      ok: false,
      error: { code: 'NOTHING_TO_REVOKE' },
    });
  });

  it('refuses one superseded by a resend', () => {
    const { useCase } = makeUseCase({ status: 'superseded', supersededBy: 'inv-2' });

    expect(useCase.execute('inv-1')).toMatchObject({
      ok: false,
      error: { code: 'NOTHING_TO_REVOKE' },
    });
  });

  it('refuses one whose time has run out — it is already dead', () => {
    const { useCase, invitations } = makeUseCase({}, laterBy(ONE_DAY_MS));

    expect(useCase.execute('inv-1')).toMatchObject({
      ok: false,
      error: { code: 'NOTHING_TO_REVOKE' },
    });
    // And leaves it alone rather than writing a status that changes nothing.
    expect(invitations.stored[0]!.status).toBe('pending');
  });
});
