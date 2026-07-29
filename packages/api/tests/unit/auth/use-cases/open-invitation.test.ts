import { describe, expect, it } from 'vitest';
import { OpenInvitation } from '../../../../src/auth/use-cases/open-invitation.js';
import { hashSecretToken } from '../../../../src/auth/random-token.js';
import { FakeInvitationRepository } from './invitation-support.js';

const TOKEN = 'a-token-that-was-issued';
const ISSUED_AT = '2026-07-29T10:00:00.000Z';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function laterBy(millis: number): string {
  return new Date(Date.parse(ISSUED_AT) + millis).toISOString();
}

function pending() {
  const invitations = new FakeInvitationRepository();
  invitations.insert({
    id: 'inv-1',
    email: 'nuevo@example.com',
    tokenHash: hashSecretToken(TOKEN),
    status: 'pending',
    issuedBy: 'admin-1',
    issuedAt: ISSUED_AT,
    acceptedAt: null,
  });
  return invitations;
}

/** A clock stopped at a chosen moment, so a test can sit either side of the window. */
function clockAt(nowIso: string) {
  return { now: () => nowIso };
}

describe('OpenInvitation', () => {
  it('names the address a good link was sent to', () => {
    const useCase = new OpenInvitation({ invitations: pending(), clock: clockAt(ISSUED_AT) });

    expect(useCase.execute(TOKEN)).toEqual({ ok: true, email: 'nuevo@example.com' });
  });

  it('leaves the invitation exactly as it was', () => {
    const invitations = pending();
    const before = structuredClone(invitations.stored);
    const useCase = new OpenInvitation({ invitations, clock: clockAt(ISSUED_AT) });

    useCase.execute(TOKEN);
    useCase.execute(TOKEN);

    expect(invitations.stored).toEqual(before);
  });

  it('refuses a link whose window has closed', () => {
    const useCase = new OpenInvitation({
      invitations: pending(),
      clock: clockAt(laterBy(ONE_DAY_MS)),
    });

    const opened = useCase.execute(TOKEN);

    expect(opened.ok).toBe(false);
    expect(opened).toMatchObject({ reason: 'expired' });
  });

  it('leaves an expired invitation expired, however often it is opened', () => {
    const invitations = pending();
    const useCase = new OpenInvitation({ invitations, clock: clockAt(laterBy(ONE_DAY_MS)) });

    useCase.execute(TOKEN);
    useCase.execute(TOKEN);

    expect(useCase.execute(TOKEN).ok).toBe(false);
    expect(invitations.stored[0]!.status).toBe('pending');
  });

  it('shows the caller the same refusal for unknown, accepted and expired', () => {
    // Identical to whoever holds the link; the reason is for the log alone.
    const invitations = pending();
    const inTime = new OpenInvitation({ invitations, clock: clockAt(ISSUED_AT) });
    const tooLate = new OpenInvitation({ invitations, clock: clockAt(laterBy(ONE_DAY_MS)) });

    const unknown = inTime.execute('a-token-nobody-ever-issued');
    const expired = tooLate.execute(TOKEN);
    invitations.markAccepted('inv-1', laterBy(1000));
    const accepted = inTime.execute(TOKEN);

    const refusals = [unknown, expired, accepted];
    for (const refusal of refusals) expect(refusal.ok).toBe(false);
    expect(new Set(refusals.map((r) => JSON.stringify(!r.ok && r.error)))).toHaveProperty(
      'size',
      1,
    );
  });

  it('names no address when it refuses', () => {
    const invitations = pending();
    invitations.markAccepted('inv-1', laterBy(1000));
    const useCase = new OpenInvitation({ invitations, clock: clockAt(laterBy(2000)) });

    expect(JSON.stringify(useCase.execute(TOKEN))).not.toContain('nuevo@example.com');
  });
});
