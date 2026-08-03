import type { Database } from './database.js';
import type { SessionStore } from '../auth/session-store.js';

interface HostSessionRow {
  revoked_at: string | null;
}

/** Backs `SessionStore` with `host_sessions`, so logout and refresh rotation can revoke a session outright. */
export class SqliteSessionStore implements SessionStore {
  constructor(private readonly db: Database) {}

  async activate(jti: string, hostId: string, expiresAt: string): Promise<void> {
    await this.db
      .prepare(`INSERT INTO host_sessions (jti, host_id, expires_at, revoked_at) VALUES (?, ?, ?, NULL)`)
      .run(jti, hostId, expiresAt);
  }

  async revoke(jti: string): Promise<void> {
    await this.db.prepare(`UPDATE host_sessions SET revoked_at = ? WHERE jti = ?`).run(new Date().toISOString(), jti);
  }

  async isActive(jti: string): Promise<boolean> {
    const row = await this.db.prepare(`SELECT revoked_at FROM host_sessions WHERE jti = ?`).get(jti) as
      | HostSessionRow
      | undefined;
    return row !== undefined && row.revoked_at === null;
  }
}
