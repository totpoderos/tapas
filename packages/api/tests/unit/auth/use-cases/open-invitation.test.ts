import { describe, expect, it } from 'vitest';
import { OpenInvitation } from '../../../../src/auth/use-cases/open-invitation.js';
import { hashSecretToken } from '../../../../src/auth/random-token.js';
import { FakeInvitationRepository } from './invitation-support.js';

const TOKEN = 'a-token-that-was-issued';

function pending() {
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
  return invitations;
}

describe('OpenInvitation', () => {
  it('names the address a good link was sent to', () => {
    const useCase = new OpenInvitation({ invitations: pending() });

    expect(useCase.execute(TOKEN)).toEqual({ ok: true, email: 'nuevo@example.com' });
  });

  it('leaves the invitation exactly as it was', () => {
    const invitations = pending();
    const before = structuredClone(invitations.stored);
    const useCase = new OpenInvitation({ invitations });

    useCase.execute(TOKEN);
    useCase.execute(TOKEN);

    expect(invitations.stored).toEqual(before);
  });

  it('refuses an unknown link and an accepted one identically', () => {
    const invitations = pending();
    const useCase = new OpenInvitation({ invitations });

    const unknown = useCase.execute('a-token-nobody-ever-issued');
    invitations.markAccepted('inv-1', '2026-07-29T11:00:00.000Z');
    const accepted = useCase.execute(TOKEN);

    expect(unknown.ok).toBe(false);
    expect(accepted).toEqual(unknown);
  });

  it('names no address when it refuses', () => {
    const invitations = pending();
    invitations.markAccepted('inv-1', '2026-07-29T11:00:00.000Z');
    const useCase = new OpenInvitation({ invitations });

    expect(JSON.stringify(useCase.execute(TOKEN))).not.toContain('nuevo@example.com');
  });
});
