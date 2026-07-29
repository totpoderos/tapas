import { describe, expect, it } from 'vitest';
import { HostAccount } from '@tapas/domain';
import { ClaimDeployment } from '../../../../src/auth/use-cases/claim-deployment.js';
import { InviteHost } from '../../../../src/auth/use-cases/invite-host.js';
import { InMemoryMailer } from '../../../../src/mail/mailer.js';
import { FakeHostAccountRepository } from '../support.js';
import { FakeInvitationRepository, FIXED_CLOCK, SequentialIds } from './invitation-support.js';

const CONFIGURED = 'operator@example.com';

function makeUseCase(...existing: HostAccount[]) {
  const accounts = new FakeHostAccountRepository();
  for (const account of existing) accounts.insert(account);
  const invitations = new FakeInvitationRepository();
  const mailer = new InMemoryMailer();
  const inviteHost = new InviteHost({
    invitations,
    accounts,
    mailer,
    ids: new SequentialIds(),
    clock: FIXED_CLOCK,
    linkBase: 'http://localhost:5173/accept-invite',
  });
  return {
    accounts,
    invitations,
    mailer,
    useCase: new ClaimDeployment({
      accounts,
      invitations,
      inviteHost,
      configuredEmail: CONFIGURED,
    }),
  };
}

const administrator = HostAccount.register('a1', 'someone@example.com', 'hash', 'admin');
const ordinaryHost = HostAccount.register('h1', 'bob@example.com', 'hash');

describe('ClaimDeployment', () => {
  it('reports a deployment with no administrator as unclaimed', () => {
    expect(makeUseCase().useCase.isUnclaimed()).toBe(true);
    expect(makeUseCase(ordinaryHost).useCase.isUnclaimed()).toBe(true);
  });

  it('reports a deployment with an administrator as claimed', () => {
    expect(makeUseCase(administrator).useCase.isUnclaimed()).toBe(false);
  });

  it('invites the configured address, for the administrator role', async () => {
    const { useCase, invitations, mailer } = makeUseCase();

    const claimed = await useCase.execute(CONFIGURED);

    expect(claimed.ok).toBe(true);
    expect(invitations.stored).toHaveLength(1);
    expect(invitations.stored[0]).toMatchObject({ email: CONFIGURED, invitedRole: 'admin' });
    expect(mailer.sent[0]!.to).toBe(CONFIGURED);
  });

  it('refuses any other address, and sends nothing', async () => {
    const { useCase, invitations, mailer } = makeUseCase();

    const claimed = await useCase.execute('someone-else@example.com');

    expect(claimed).toMatchObject({ ok: false, error: { code: 'CLAIM_REFUSED' } });
    expect(invitations.stored).toHaveLength(0);
    expect(mailer.sent).toHaveLength(0);
  });

  it('never says what the configured address is', async () => {
    const { useCase } = makeUseCase();

    const claimed = await useCase.execute('someone-else@example.com');

    expect(JSON.stringify(claimed)).not.toContain(CONFIGURED);
  });

  it('matches the configured address regardless of case and surrounding space', async () => {
    const { useCase } = makeUseCase();

    expect((await useCase.execute('  Operator@Example.COM  ')).ok).toBe(true);
  });

  it('refuses once the deployment has an administrator', async () => {
    const { useCase, mailer } = makeUseCase(administrator);

    expect(await useCase.execute(CONFIGURED)).toMatchObject({
      ok: false,
      error: { code: 'SETUP_COMPLETE' },
    });
    expect(mailer.sent).toHaveLength(0);
  });

  it('claiming again supersedes the outstanding invitation rather than leaving two live links', async () => {
    const { useCase, invitations, mailer } = makeUseCase();

    await useCase.execute(CONFIGURED);
    const second = await useCase.execute(CONFIGURED);

    expect(second.ok).toBe(true);
    expect(mailer.sent).toHaveLength(2);
    expect(invitations.stored[0]).toMatchObject({
      status: 'superseded',
      supersededBy: second.ok ? second.invitationId : undefined,
    });
    expect(invitations.stored[1]!.status).toBe('pending');
  });
});
