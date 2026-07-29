import type { DatabaseSync } from 'node:sqlite';
import type { HostRole } from '@tapas/domain';

/**
 * How an invitation stands, as stored. Expiry is deliberately absent: it is a
 * question about the clock that anyone can answer at any time, whereas these
 * are events that happened. See `usabilityOf`, which is the only place the two
 * kinds are brought together.
 */
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'superseded';

export interface StoredInvitation {
  readonly id: string;
  readonly email: string;
  readonly tokenHash: string;
  readonly status: InvitationStatus;
  readonly issuedBy: string;
  readonly issuedAt: string;
  readonly acceptedAt: string | null;
  readonly revokedAt: string | null;
  /** The role this invitation creates when accepted. Only a claim on an unclaimed deployment sets 'admin'. */
  readonly invitedRole: HostRole;
  /**
   * Whether this invitation's message was handed off to a mail server — not
   * whether it was delivered, which nothing here can observe. `null` for
   * invitations issued before anything could fail to send.
   */
  readonly messageSent: boolean | null;
  /** The invitation that replaced this one, when it was superseded by a resend. */
  readonly supersededBy: string | null;
}

export interface HostInvitationRepository {
  insert(invitation: StoredInvitation): void;
  findByTokenHash(tokenHash: string): StoredInvitation | undefined;
  findById(id: string): StoredInvitation | undefined;
  listAll(): StoredInvitation[];
  markAccepted(id: string, acceptedAt: string): void;
  markRevoked(id: string, revokedAt: string): void;
  markSuperseded(id: string, supersededBy: string): void;
  recordHandoff(id: string, messageSent: boolean): void;
}

interface InvitationRow {
  id: string;
  email: string;
  token_hash: string;
  status: string;
  issued_by: string;
  issued_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  superseded_by: string | null;
  invited_role: string;
  message_sent: number | null;
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
    revokedAt: row.revoked_at,
    supersededBy: row.superseded_by,
    invitedRole: row.invited_role as HostRole,
    messageSent: row.message_sent === null ? null : row.message_sent === 1,
  };
}

export class SqliteHostInvitationRepository implements HostInvitationRepository {
  constructor(private readonly db: DatabaseSync) {}

  insert(invitation: StoredInvitation): void {
    this.db
      .prepare(
        `INSERT INTO host_invitations (id, email, token_hash, status, issued_by, issued_at, accepted_at, revoked_at, superseded_by, invited_role, message_sent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        invitation.id,
        invitation.email,
        invitation.tokenHash,
        invitation.status,
        invitation.issuedBy,
        invitation.issuedAt,
        invitation.acceptedAt,
        invitation.revokedAt,
        invitation.supersededBy,
        invitation.invitedRole,
        invitation.messageSent === null ? null : Number(invitation.messageSent),
      );
  }

  findByTokenHash(tokenHash: string): StoredInvitation | undefined {
    const row = this.db
      .prepare(`SELECT * FROM host_invitations WHERE token_hash = ?`)
      .get(tokenHash) as unknown as InvitationRow | undefined;
    return row ? toInvitation(row) : undefined;
  }

  findById(id: string): StoredInvitation | undefined {
    const row = this.db.prepare(`SELECT * FROM host_invitations WHERE id = ?`).get(id) as unknown as
      | InvitationRow
      | undefined;
    return row ? toInvitation(row) : undefined;
  }

  listAll(): StoredInvitation[] {
    const rows = this.db
      .prepare(`SELECT * FROM host_invitations ORDER BY issued_at`)
      .all() as unknown as InvitationRow[];
    return rows.map(toInvitation);
  }

  markAccepted(id: string, acceptedAt: string): void {
    this.db
      .prepare(`UPDATE host_invitations SET status = 'accepted', accepted_at = ? WHERE id = ?`)
      .run(acceptedAt, id);
  }

  markRevoked(id: string, revokedAt: string): void {
    this.db
      .prepare(`UPDATE host_invitations SET status = 'revoked', revoked_at = ? WHERE id = ?`)
      .run(revokedAt, id);
  }

  markSuperseded(id: string, supersededBy: string): void {
    this.db
      .prepare(`UPDATE host_invitations SET status = 'superseded', superseded_by = ? WHERE id = ?`)
      .run(supersededBy, id);
  }

  recordHandoff(id: string, messageSent: boolean): void {
    this.db
      .prepare(`UPDATE host_invitations SET message_sent = ? WHERE id = ?`)
      .run(Number(messageSent), id);
  }
}
