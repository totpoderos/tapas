import type { Database } from '../../../src/db/database.js';
import { freshDatabase } from '../../support/test-database.js';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  SqliteHostInvitationRepository,
  type StoredInvitation,
} from '../../../src/db/host-invitation-repository.js';

const INVITATION: StoredInvitation = {
  id: 'inv-1',
  email: 'nuevo@example.com',
  tokenHash: 'the-hash',
  status: 'pending',
  issuedBy: 'admin-1',
  issuedAt: '2026-07-29T10:00:00.000Z',
  acceptedAt: null,
  revokedAt: null,
  supersededBy: null,
  invitedRole: 'host',
  messageSent: null,
};

describe('SqliteHostInvitationRepository', async () => {
  let database: Database;
  let invitations: SqliteHostInvitationRepository;

  beforeEach(async () => {
    ({ database } = await freshDatabase());
    invitations = new SqliteHostInvitationRepository(database);
  });

  it('round-trips an invitation, found by its token hash', async () => {
    await invitations.insert(INVITATION);

    expect(await invitations.findByTokenHash('the-hash')).toEqual(INVITATION);
  });

  it('finds nothing for a hash it never stored', async () => {
    await invitations.insert(INVITATION);

    expect(await invitations.findByTokenHash('some-other-hash')).toBeUndefined();
  });

  it('marks an invitation accepted', async () => {
    await invitations.insert(INVITATION);

    await invitations.markAccepted('inv-1', '2026-07-29T11:00:00.000Z');

    expect(await invitations.findByTokenHash('the-hash')).toMatchObject({
      status: 'accepted',
      acceptedAt: '2026-07-29T11:00:00.000Z',
    });
  });

  it('records a handoff that succeeded and one that did not', async () => {
    await invitations.insert(INVITATION);

    await invitations.recordHandoff('inv-1', true);
    expect((await invitations.findById('inv-1'))?.messageSent).toBe(true);

    await invitations.recordHandoff('inv-1', false);
    expect((await invitations.findById('inv-1'))?.messageSent).toBe(false);
  });

  it('leaves an invitation from before anything could fail to send unrecorded', async () => {
    // Null is not "did not send" — it is "nothing was ever observed". Existing
    // rows were sent by a mailer that could not fail; giving them an outcome
    // would be inventing history.
    await invitations.insert(INVITATION);

    expect((await invitations.findById('inv-1'))?.messageSent).toBeNull();
  });

  it('refuses to store two invitations with the same token hash', async () => {
    await invitations.insert(INVITATION);

    await expect(invitations.insert({ ...INVITATION, id: 'inv-2' })).rejects.toThrow();
  });

  it('finds an invitation by id — how an administrator names one', async () => {
    await invitations.insert(INVITATION);

    expect(await invitations.findById('inv-1')).toEqual(INVITATION);
    expect(await invitations.findById('inv-nobody-issued')).toBeUndefined();
  });

  it('marks an invitation revoked, with the moment it happened', async () => {
    await invitations.insert(INVITATION);

    await invitations.markRevoked('inv-1', '2026-07-29T11:00:00.000Z');

    expect(await invitations.findById('inv-1')).toMatchObject({
      status: 'revoked',
      revokedAt: '2026-07-29T11:00:00.000Z',
    });
  });

  it('marks an invitation superseded, pointing at what replaced it', async () => {
    await invitations.insert(INVITATION);

    await invitations.markSuperseded('inv-1', 'inv-2');

    expect(await invitations.findById('inv-1')).toMatchObject({
      status: 'superseded',
      supersededBy: 'inv-2',
    });
  });

  it('lists every invitation, oldest first', async () => {
    await invitations.insert({ ...INVITATION, id: 'inv-2', tokenHash: 'h2', issuedAt: '2026-07-30T10:00:00.000Z' });
    await invitations.insert(INVITATION);

    expect((await invitations.listAll()).map((invitation) => invitation.id)).toEqual(['inv-1', 'inv-2']);
  });
});
