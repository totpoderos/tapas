import type { Database } from './database.js';
import type { StoredHostPat } from '../auth/stored-host-pat.js';

export interface HostPatRepository {
  insert(pat: StoredHostPat): Promise<void>;
  findById(id: string): Promise<StoredHostPat | undefined>;
  findByTokenHash(tokenHash: string): Promise<StoredHostPat | undefined>;
  revoke(id: string): Promise<void>;
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
  constructor(private readonly db: Database) {}

  async insert(pat: StoredHostPat): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO host_pats (id, host_id, token_hash, created_at, revoked_at) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(pat.id, pat.hostId, pat.tokenHash, pat.createdAt, pat.revokedAt);
  }

  async findById(id: string): Promise<StoredHostPat | undefined> {
    const row = await this.db.prepare(`SELECT * FROM host_pats WHERE id = ?`).get(id) as unknown as
      HostPatRow | undefined;
    return row ? toPat(row) : undefined;
  }

  async findByTokenHash(tokenHash: string): Promise<StoredHostPat | undefined> {
    const row = await this.db
      .prepare(`SELECT * FROM host_pats WHERE token_hash = ?`)
      .get(tokenHash) as unknown as HostPatRow | undefined;
    return row ? toPat(row) : undefined;
  }

  async revoke(id: string): Promise<void> {
    await this.db
      .prepare(`UPDATE host_pats SET revoked_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), id);
  }
}
