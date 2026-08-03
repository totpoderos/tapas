import { describe, expect, it } from 'vitest';
import { OpenInvitation } from '../../../../src/auth/use-cases/open-invitation.js';
import { hashSecretToken } from '../../../../src/auth/random-token.js';
import { FakeInvitationRepository, pendingInvitation } from './invitation-support.js';

const TOKEN = 'a-token-that-was-issued';
const ISSUED_AT = '2026-07-29T10:00:00.000Z';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function laterBy(millis: number): string {
  return new Date(Date.parse(ISSUED_AT) + millis).toISOString();
}

async function pending() {
  const invitations = new FakeInvitationRepository();
  await invitations.insert(pendingInvitation({ tokenHash: hashSecretToken(TOKEN), issuedAt: ISSUED_AT }));
  return invitations;
}

/** A clock stopped at a chosen moment, so a test can sit either side of the window. */
function clockAt(nowIso: string) {
  return { now: () => nowIso };
}

describe('OpenInvitation', async () => {
  it('names the address a good link was sent to', async () => {
    const useCase = new OpenInvitation({ invitations: await pending(), clock: clockAt(ISSUED_AT) });

    expect(await useCase.execute(TOKEN)).toEqual({ ok: true, email: 'nuevo@example.com' });
  });

  it('leaves the invitation exactly as it was', async () => {
    const invitations = await pending();
    const before = structuredClone(invitations.stored);
    const useCase = new OpenInvitation({ invitations, clock: clockAt(ISSUED_AT) });

    await useCase.execute(TOKEN);
    await useCase.execute(TOKEN);

    expect(invitations.stored).toEqual(before);
  });

  it('refuses a link whose window has closed', async () => {
    const useCase = new OpenInvitation({
      invitations: await pending(),
      clock: clockAt(laterBy(ONE_DAY_MS)),
    });

    const opened = await useCase.execute(TOKEN);

    expect(opened.ok).toBe(false);
    expect(opened).toMatchObject({ reason: 'expired' });
  });

  it('leaves an expired invitation expired, however often it is opened', async () => {
    const invitations = await pending();
    const useCase = new OpenInvitation({ invitations, clock: clockAt(laterBy(ONE_DAY_MS)) });

    await useCase.execute(TOKEN);
    await useCase.execute(TOKEN);

    expect((await useCase.execute(TOKEN)).ok).toBe(false);
    expect(invitations.stored[0]!.status).toBe('pending');
  });

  it('shows the caller the same refusal for unknown, accepted and expired', async () => {
    // Identical to whoever holds the link; the reason is for the log alone.
    const invitations = await pending();
    const inTime = new OpenInvitation({ invitations, clock: clockAt(ISSUED_AT) });
    const tooLate = new OpenInvitation({ invitations, clock: clockAt(laterBy(ONE_DAY_MS)) });

    const unknown = await inTime.execute('a-token-nobody-ever-issued');
    const expired = await tooLate.execute(TOKEN);
    await invitations.markAccepted('inv-1', laterBy(1000));
    const accepted = await inTime.execute(TOKEN);

    const refusals = [unknown, expired, accepted];
    for (const refusal of refusals) expect(refusal.ok).toBe(false);
    expect(new Set(refusals.map((r) => JSON.stringify(!r.ok && r.error)))).toHaveProperty(
      'size',
      1,
    );
  });

  it('names no address when it refuses', async () => {
    const invitations = await pending();
    await invitations.markAccepted('inv-1', laterBy(1000));
    const useCase = new OpenInvitation({ invitations, clock: clockAt(laterBy(2000)) });

    expect(JSON.stringify(await useCase.execute(TOKEN))).not.toContain('nuevo@example.com');
  });
});
