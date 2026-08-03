import { describe, expect, it } from 'vitest';
import { InviteHost } from '../../../../src/auth/use-cases/invite-host.js';
import { ResendInvitation } from '../../../../src/auth/use-cases/resend-invitation.js';
import { InMemoryMailer } from '../../../../src/mail/mailer.js';
import { FakeHostAccountRepository } from '../support.js';
import { FakeInvitationRepository, pendingInvitation, SequentialIds } from './invitation-support.js';

const ISSUED_AT = '2026-07-29T10:00:00.000Z';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const LINK_BASE = 'http://localhost:5173/accept-invite';

function laterBy(millis: number): string {
  return new Date(Date.parse(ISSUED_AT) + millis).toISOString();
}

async function makeUseCase(overrides = {}, nowIso = laterBy(1000)) {
  const invitations = new FakeInvitationRepository();
  await invitations.insert(pendingInvitation(overrides));
  const mailer = new InMemoryMailer();
  const inviteHost = new InviteHost({
    invitations,
    accounts: new FakeHostAccountRepository(),
    mailer,
    ids: new SequentialIds(),
    clock: { now: () => nowIso },
    linkBase: LINK_BASE,
  });
  return { invitations, mailer, useCase: new ResendInvitation({ invitations, inviteHost }) };
}

describe('ResendInvitation', async () => {
  it('issues a new invitation to the same address', async () => {
    const { useCase, invitations, mailer } = await makeUseCase();

    const resent = await useCase.execute('inv-1', 'admin-1');

    expect(resent.ok).toBe(true);
    expect(invitations.stored).toHaveLength(2);
    expect(invitations.stored[1]!.email).toBe('nuevo@example.com');
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]!.to).toBe('nuevo@example.com');
  });

  it('gives the new invitation its own token and its own window', async () => {
    const { useCase, invitations } = await makeUseCase();

    await useCase.execute('inv-1', 'admin-1');

    expect(invitations.stored[1]!.tokenHash).not.toBe(invitations.stored[0]!.tokenHash);
    expect(invitations.stored[1]!.issuedAt).toBe(laterBy(1000));
  });

  it('supersedes the original and points it at its replacement', async () => {
    const { useCase, invitations } = await makeUseCase();

    const resent = await useCase.execute('inv-1', 'admin-1');

    expect(invitations.stored[0]).toMatchObject({
      status: 'superseded',
      supersededBy: resent.ok ? resent.invitationId : undefined,
    });
  });

  it('resends one whose time has run out — expiring is not a decision', async () => {
    const { useCase, invitations } = await makeUseCase({}, laterBy(ONE_DAY_MS * 2));

    const resent = await useCase.execute('inv-1', 'admin-1');

    expect(resent.ok).toBe(true);
    expect(invitations.stored).toHaveLength(2);
  });

  it('refuses one that was revoked — a decision is not undone by resending', async () => {
    const { useCase, invitations } = await makeUseCase({ status: 'revoked', revokedAt: laterBy(500) });

    const resent = await useCase.execute('inv-1', 'admin-1');

    expect(resent).toMatchObject({ ok: false, error: { code: 'INVITATION_FINISHED' } });
    expect(invitations.stored).toHaveLength(1);
  });

  it('refuses one that was accepted', async () => {
    const { useCase } = await makeUseCase({ status: 'accepted', acceptedAt: laterBy(500) });

    expect(await useCase.execute('inv-1', 'admin-1')).toMatchObject({
      ok: false,
      error: { code: 'INVITATION_FINISHED' },
    });
  });

  it('refuses one that was already superseded', async () => {
    const { useCase } = await makeUseCase({ status: 'superseded', supersededBy: 'inv-2' });

    expect(await useCase.execute('inv-1', 'admin-1')).toMatchObject({
      ok: false,
      error: { code: 'INVITATION_FINISHED' },
    });
  });

  it('refuses one nobody issued', async () => {
    const { useCase } = await makeUseCase();

    expect(await useCase.execute('inv-nobody-issued', 'admin-1')).toMatchObject({
      ok: false,
      error: { code: 'INVITATION_NOT_FOUND' },
    });
  });
});
