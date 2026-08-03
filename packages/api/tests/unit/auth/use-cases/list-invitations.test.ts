import { describe, expect, it } from 'vitest';
import { ListInvitations } from '../../../../src/auth/use-cases/list-invitations.js';
import { FakeInvitationRepository, pendingInvitation } from './invitation-support.js';

const ISSUED_AT = '2026-07-29T10:00:00.000Z';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function laterBy(millis: number): string {
  return new Date(Date.parse(ISSUED_AT) + millis).toISOString();
}

async function listAt(nowIso: string, ...invitations: Awaited<ReturnType<typeof pendingInvitation>>[]) {
  const repository = new FakeInvitationRepository();
  for (const invitation of invitations) await repository.insert(invitation);
  return await new ListInvitations({ invitations: repository, clock: { now: () => nowIso } }).execute();
}

describe('ListInvitations', async () => {
  it('reports the address, standing and when it was issued', async () => {
    expect(await listAt(laterBy(1000), pendingInvitation())).toEqual([
      { id: 'inv-1', email: 'nuevo@example.com', status: 'pending', issuedAt: ISSUED_AT },
    ]);
  });

  it('shows an invitation past its window as expired, though it is stored as pending', async () => {
    const stored = pendingInvitation();
    expect(stored.status).toBe('pending');

    expect((await listAt(laterBy(ONE_DAY_MS), stored))[0]!.status).toBe('expired');
  });

  it('reports each stored ending under its own name', async () => {
    const listed = await listAt(
      laterBy(1000),
      pendingInvitation({ id: 'a', status: 'accepted', acceptedAt: laterBy(500) }),
      pendingInvitation({ id: 'b', status: 'revoked', revokedAt: laterBy(500) }),
      pendingInvitation({ id: 'c', status: 'superseded', supersededBy: 'd' }),
    );

    expect(listed.map((invitation) => invitation.status)).toEqual([
      'accepted',
      'revoked',
      'superseded',
    ]);
  });

  it('prefers the recorded ending over expiry when both are true', async () => {
    // Revoked a day ago and long past its window: an administrator should see
    // what was done, not what time did.
    const listed = await listAt(
      laterBy(ONE_DAY_MS * 3),
      pendingInvitation({ status: 'revoked', revokedAt: laterBy(500) }),
    );

    expect(listed[0]!.status).toBe('revoked');
  });

  it('reveals no token or hash', async () => {
    const serialized = JSON.stringify(await listAt(laterBy(1000), pendingInvitation()));

    expect(serialized).not.toContain('the-hash');
    expect(Object.keys((await listAt(laterBy(1000), pendingInvitation()))[0]!)).toEqual([
      'id',
      'email',
      'status',
      'issuedAt',
    ]);
  });

  it('lists nothing when nobody has been invited', async () => {
    expect(await listAt(laterBy(1000))).toEqual([]);
  });
});
