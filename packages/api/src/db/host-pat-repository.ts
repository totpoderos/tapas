import type { DatabaseSync } from 'node:sqlite';
import type { StoredHostPat } from '../auth/stored-host-pat.js';

export interface HostPatRepository {
  insert(pat: StoredHostPat): void;
  findById(id: string): StoredHostPat | undefined;
  findByTokenHash(tokenHash: string): StoredHostPat | undefined;
  revoke(id: string): void;
}

interface HostPatRow {
  id: string;
  host_id: string;
  token_hash: string;
  created_at: string;
  revoked_at: string | null;
}

function toPat(row: HostPatRow): StoredHostPat {
  return {
    id: row.id,
    hostId: row.host_id,
    tokenHash: row.token_hash,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  };
}

export class SqliteHostPatRepository implements HostPatRepository {
  constructor(private readonly db: DatabaseSync) {}

  insert(pat: StoredHostPat): void {
    this.db
      .prepare(
        `INSERT INTO host_pats (id, host_id, token_hash, created_at, revoked_at) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(pat.id, pat.hostId, pat.tokenHash, pat.createdAt, pat.revokedAt);
  }

  findById(id: string): StoredHostPat | undefined {
    const row = this.db.prepare(`SELECT * FROM host_pats WHERE id = ?`).get(id) as unknown as
      HostPatRow | undefined;
    return row ? toPat(row) : undefined;
  }

  findByTokenHash(tokenHash: string): StoredHostPat | undefined {
    const row = this.db
      .prepare(`SELECT * FROM host_pats WHERE token_hash = ?`)
      .get(tokenHash) as unknown as HostPatRow | undefined;
    return row ? toPat(row) : undefined;
  }

  revoke(id: string): void {
    this.db
      .prepare(`UPDATE host_pats SET revoked_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), id);
  }
}
