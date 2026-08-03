import { describe, expect, it } from 'vitest';
import { HostAccount } from '@tapas/domain';
import { InviteHost } from '../../../../src/auth/use-cases/invite-host.js';
import { hashSecretToken } from '../../../../src/auth/random-token.js';
import { InMemoryMailer } from '../../../../src/mail/mailer.js';
import { FakeHostAccountRepository } from '../support.js';
import { FakeInvitationRepository, FIXED_CLOCK, SequentialIds } from './invitation-support.js';

const LINK_BASE = 'http://localhost:5173/accept-invite';

function makeUseCase(accounts = new FakeHostAccountRepository()) {
  const invitations = new FakeInvitationRepository();
  const mailer = new InMemoryMailer();
  const useCase = new InviteHost({
    invitations,
    accounts,
    mailer,
    ids: new SequentialIds(),
    clock: FIXED_CLOCK,
    linkBase: LINK_BASE,
  });
  return { useCase, invitations, mailer, accounts };
}

describe('InviteHost', async () => {
  it('creates a pending invitation for the address', async () => {
    const { useCase, invitations } = makeUseCase();

    const invited = await useCase.execute('nuevo@example.com', 'admin-1');

    expect(invited.ok).toBe(true);
    expect(invitations.stored).toHaveLength(1);
    expect(invitations.stored[0]).toMatchObject({
      email: 'nuevo@example.com',
      status: 'pending',
      issuedBy: 'admin-1',
      acceptedAt: null,
    });
  });

  it('sends the link to the invited address and stores only its hash', async () => {
    const { useCase, invitations, mailer } = makeUseCase();

    await useCase.execute('nuevo@example.com', 'admin-1');

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]!.to).toBe('nuevo@example.com');

    const token = mailer.sent[0]!.link.slice(LINK_BASE.length + 1);
    expect(token).not.toBe('');
    expect(invitations.stored[0]!.tokenHash).toBe(hashSecretToken(token));
    expect(JSON.stringify(invitations.stored)).not.toContain(token);
  });

  it('gives each invitation a different token', async () => {
    const { useCase, mailer } = makeUseCase();

    await useCase.execute('one@example.com', 'admin-1');
    await useCase.execute('two@example.com', 'admin-1');

    expect(mailer.sent[0]!.link).not.toBe(mailer.sent[1]!.link);
  });

  it('refuses an address that already has a host account', async () => {
    const accounts = new FakeHostAccountRepository();
    await accounts.insert(HostAccount.register('h1', 'taken@example.com', 'hash'));
    const { useCase, invitations, mailer } = makeUseCase(accounts);

    const invited = await useCase.execute('taken@example.com', 'admin-1');

    expect(invited).toEqual({
      ok: false,
      error: { code: 'EMAIL_TAKEN', message: 'That address is already registered.' },
    });
    expect(invitations.stored).toHaveLength(0);
    expect(mailer.sent).toHaveLength(0);
  });

  it('keeps the invitation when no mail server will take the message', async () => {
    const { useCase, invitations, mailer } = makeUseCase();
    mailer.failEverySend();

    const invited = await useCase.execute('nuevo@example.com', 'admin-1');

    // The comment in this use case promised exactly this and the code did not
    // do it: an unguarded await turned a stored, live invitation into a thrown
    // request carrying neither the link nor the id needed to resend it.
    expect(invited.ok).toBe(true);
    expect(invitations.stored).toHaveLength(1);
    expect(invitations.stored[0]!.status).toBe('pending');
  });

  it('says the message did not go out, and hands back the link', async () => {
    const { useCase, invitations, mailer } = makeUseCase();
    mailer.failEverySend();

    const invited = await useCase.execute('nuevo@example.com', 'admin-1');

    expect(invited).toMatchObject({ ok: true, messageSent: false });
    const link = invited.ok ? invited.link : undefined;
    expect(link).toContain(LINK_BASE);
    // The link is the one the stored hash matches — the same invitation, not a new one.
    expect(invitations.stored[0]!.tokenHash).toBe(hashSecretToken(link!.slice(LINK_BASE.length + 1)));
  });

  it('records that the message did not go out', async () => {
    const { useCase, invitations, mailer } = makeUseCase();
    mailer.failEverySend();

    await useCase.execute('nuevo@example.com', 'admin-1');

    expect(invitations.stored[0]!.messageSent).toBe(false);
  });

  it('says the message went out, and hands back no link, when it did', async () => {
    const { useCase, invitations } = makeUseCase();

    const invited = await useCase.execute('nuevo@example.com', 'admin-1');

    expect(invited).toMatchObject({ ok: true, messageSent: true });
    expect(invited.ok && invited.link).toBeUndefined();
    expect(invitations.stored[0]!.messageSent).toBe(true);
  });

  it('never stores the link, even when it had to hand it back', async () => {
    const { useCase, invitations, mailer } = makeUseCase();
    mailer.failEverySend();

    const invited = await useCase.execute('nuevo@example.com', 'admin-1');
    const token = (invited.ok ? invited.link! : '').slice(LINK_BASE.length + 1);

    expect(JSON.stringify(invitations.stored)).not.toContain(token);
  });

  it('refuses an address that is not an email', async () => {
    const { useCase, invitations, mailer } = makeUseCase();

    const invited = await useCase.execute('not-an-address', 'admin-1');

    expect(invited.ok).toBe(false);
    expect(invitations.stored).toHaveLength(0);
    expect(mailer.sent).toHaveLength(0);
  });
});
