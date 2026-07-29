import type { DatabaseSync } from 'node:sqlite';

export type InvitationStatus = 'pending' | 'accepted';

export interface StoredInvitation {
  readonly id: string;
  readonly email: string;
  readonly tokenHash: string;
  readonly status: InvitationStatus;
  readonly issuedBy: string;
  readonly issuedAt: string;
  readonly acceptedAt: string | null;
}

export interface HostInvitationRepository {
  insert(invitation: StoredInvitation): void;
  findByTokenHash(tokenHash: string): StoredInvitation | undefined;
  markAccepted(id: string, acceptedAt: string): void;
}

interface InvitationRow {
  id: string;
  email: string;
  token_hash: string;
  status: string;
  issued_by: string;
  issued_at: string;
  accepted_at: string | null;
}

function toInvitation(row: InvitationRow): StoredInvitation {
  return {
    id: row.id,
    email: row.email,
    tokenHash: row.token_hash,
    status: row.status as InvitationStatus,
    issuedBy: row.issued_by,
    issuedAt: row.issued_at,
    acceptedAt: row.accepted_at,
  };
}

export class SqliteHostInvitationRepository implements HostInvitationRepository {
  constructor(private readonly db: DatabaseSync) {}

  insert(invitation: StoredInvitation): void {
    this.db
      .prepare(
        `INSERT INTO host_invitations (id, email, token_hash, status, issued_by, issued_at, accepted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        invitation.id,
        invitation.email,
        invitation.tokenHash,
        invitation.status,
        invitation.issuedBy,
        invitation.issuedAt,
        invitation.acceptedAt,
      );
  }

  findByTokenHash(tokenHash: string): StoredInvitation | undefined {
    const row = this.db
      .prepare(`SELECT * FROM host_invitations WHERE token_hash = ?`)
      .get(tokenHash) as unknown as InvitationRow | undefined;
    return row ? toInvitation(row) : undefined;
  }

  markAccepted(id: string, acceptedAt: string): void {
    this.db
      .prepare(`UPDATE host_invitations SET status = 'accepted', accepted_at = ? WHERE id = ?`)
      .run(acceptedAt, id);
  }
}
