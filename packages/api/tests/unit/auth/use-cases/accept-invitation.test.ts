import { describe, expect, it } from 'vitest';
import { AcceptInvitation } from '../../../../src/auth/use-cases/accept-invitation.js';
import { RegisterHost } from '../../../../src/auth/use-cases/register-host.js';
import { hashSecretToken } from '../../../../src/auth/random-token.js';
import { FakeHostAccountRepository, FakePasswordHasher } from '../support.js';
import { FakeInvitationRepository, FIXED_CLOCK, SequentialIds } from './invitation-support.js';

const TOKEN = 'a-token-that-was-issued';
const STRONG_PASSWORD = 'Str0ng!Passw0rd';

function makeUseCase() {
  const invitations = new FakeInvitationRepository();
  invitations.insert({
    id: 'inv-1',
    email: 'nuevo@example.com',
    tokenHash: hashSecretToken(TOKEN),
    status: 'pending',
    issuedBy: 'admin-1',
    issuedAt: '2026-07-29T10:00:00.000Z',
    acceptedAt: null,
  });
  const accounts = new FakeHostAccountRepository();
  const registerHost = new RegisterHost({
    accounts,
    hasher: new FakePasswordHasher(),
    ids: new SequentialIds(),
  });
  const useCase = new AcceptInvitation({ invitations, registerHost, clock: FIXED_CLOCK });
  return { useCase, invitations, accounts };
}

describe('AcceptInvitation', () => {
  it('creates a host account for the address the invitation was sent to', async () => {
    const { useCase, accounts } = makeUseCase();

    const accepted = await useCase.execute(TOKEN, STRONG_PASSWORD);

    expect(accepted.ok).toBe(true);
    expect(accounts.findByEmail('nuevo@example.com')).toBeDefined();
  });

  it('creates an ordinary host, never an administrator', async () => {
    const { useCase, accounts } = makeUseCase();

    await useCase.execute(TOKEN, STRONG_PASSWORD);

    expect(accounts.findByEmail('nuevo@example.com')?.role).toBe('host');
  });

  it('marks the invitation accepted', async () => {
    const { useCase, invitations } = makeUseCase();

    await useCase.execute(TOKEN, STRONG_PASSWORD);

    expect(invitations.stored[0]).toMatchObject({
      status: 'accepted',
      acceptedAt: '2026-07-29T10:00:00.000Z',
    });
  });

  it('shows the same refusal for a link already accepted and one that never existed', async () => {
    const { useCase } = makeUseCase();
    await useCase.execute(TOKEN, STRONG_PASSWORD);

    const again = await useCase.execute(TOKEN, STRONG_PASSWORD);
    const unknown = await useCase.execute('a-token-nobody-ever-issued', STRONG_PASSWORD);

    expect(again.ok).toBe(false);
    expect(unknown.ok).toBe(false);
    // The refusal is identical; only the reason kept back for the log differs.
    expect(!again.ok && again.error).toEqual(!unknown.ok && unknown.error);
    expect(again).toMatchObject({ reason: 'already_accepted' });
    expect(unknown).toMatchObject({ reason: 'unknown' });
  });

  it('refuses a link whose window has closed, and creates no account', async () => {
    const { invitations, accounts } = makeUseCase();
    const registerHost = new RegisterHost({
      accounts,
      hasher: new FakePasswordHasher(),
      ids: new SequentialIds(),
    });
    const tooLate = new AcceptInvitation({
      invitations,
      registerHost,
      clock: { now: () => '2026-07-30T10:00:00.000Z' }, // exactly 24h after issuing
    });

    const accepted = await tooLate.execute(TOKEN, STRONG_PASSWORD);

    expect(accepted.ok).toBe(false);
    expect(accepted).toMatchObject({ reason: 'expired' });
    expect(accounts.findByEmail('nuevo@example.com')).toBeUndefined();
  });

  it('refuses a password that fails the policy', async () => {
    const { useCase, accounts } = makeUseCase();

    const accepted = await useCase.execute(TOKEN, 'short');

    expect(accepted).toEqual({
      ok: false,
      error: { code: 'WEAK_PASSWORD', message: 'Password does not meet the policy.' },
    });
    expect(accounts.findByEmail('nuevo@example.com')).toBeUndefined();
  });

  it('leaves the invitation pending after a refused password', async () => {
    const { useCase, invitations } = makeUseCase();

    await useCase.execute(TOKEN, 'short');

    expect(invitations.stored[0]!.status).toBe('pending');
    expect((await useCase.execute(TOKEN, STRONG_PASSWORD)).ok).toBe(true);
  });

  it('names no address when it refuses an unusable link', async () => {
    const { useCase } = makeUseCase();

    const refused = await useCase.execute('a-token-nobody-ever-issued', STRONG_PASSWORD);

    expect(JSON.stringify(refused)).not.toContain('@');
  });
});
