import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../../../src/db/migrate.js';
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
};

describe('SqliteHostInvitationRepository', () => {
  let db: DatabaseSync;
  let invitations: SqliteHostInvitationRepository;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    runMigrations(db);
    invitations = new SqliteHostInvitationRepository(db);
  });

  it('round-trips an invitation, found by its token hash', () => {
    invitations.insert(INVITATION);

    expect(invitations.findByTokenHash('the-hash')).toEqual(INVITATION);
  });

  it('finds nothing for a hash it never stored', () => {
    invitations.insert(INVITATION);

    expect(invitations.findByTokenHash('some-other-hash')).toBeUndefined();
  });

  it('marks an invitation accepted', () => {
    invitations.insert(INVITATION);

    invitations.markAccepted('inv-1', '2026-07-29T11:00:00.000Z');

    expect(invitations.findByTokenHash('the-hash')).toMatchObject({
      status: 'accepted',
      acceptedAt: '2026-07-29T11:00:00.000Z',
    });
  });

  it('refuses to store two invitations with the same token hash', () => {
    invitations.insert(INVITATION);

    expect(() => invitations.insert({ ...INVITATION, id: 'inv-2' })).toThrow();
  });

  it('finds an invitation by id — how an administrator names one', () => {
    invitations.insert(INVITATION);

    expect(invitations.findById('inv-1')).toEqual(INVITATION);
    expect(invitations.findById('inv-nobody-issued')).toBeUndefined();
  });

  it('marks an invitation revoked, with the moment it happened', () => {
    invitations.insert(INVITATION);

    invitations.markRevoked('inv-1', '2026-07-29T11:00:00.000Z');

    expect(invitations.findById('inv-1')).toMatchObject({
      status: 'revoked',
      revokedAt: '2026-07-29T11:00:00.000Z',
    });
  });

  it('marks an invitation superseded, pointing at what replaced it', () => {
    invitations.insert(INVITATION);

    invitations.markSuperseded('inv-1', 'inv-2');

    expect(invitations.findById('inv-1')).toMatchObject({
      status: 'superseded',
      supersededBy: 'inv-2',
    });
  });

  it('lists every invitation, oldest first', () => {
    invitations.insert({ ...INVITATION, id: 'inv-2', tokenHash: 'h2', issuedAt: '2026-07-30T10:00:00.000Z' });
    invitations.insert(INVITATION);

    expect(invitations.listAll().map((invitation) => invitation.id)).toEqual(['inv-1', 'inv-2']);
  });
});
