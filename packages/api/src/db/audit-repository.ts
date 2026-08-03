import type { Database } from './database.js';
import type { AuditEntry, SourcePath } from '@tapas/shared';

export interface AuditLogRepository {
  append(entry: AuditEntry): Promise<void>;
  findByContest(contestId: string): Promise<AuditEntry[]>;
  /**
   * Removes a contest's recorded history. The ONLY caller is deleting a contest,
   * and it appends the tombstone straight afterwards — see `DeleteContest` for
   * why the log is reduced there and nowhere else in the system.
   */
  deleteByContest(contestId: string): Promise<void>;
}

interface AuditRow {
  id: string;
  contest_id: string;
  actor_id: string;
  type: string;
  before_json: string | null;
  after_json: string | null;
  source_path: string;
  tool_name: string | null;
  tool_args: string | null;
  confirmation: string | null;
  occurred_at: string;
}

function jsonOrNull(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

function parseOrUndefined(value: string | null): unknown {
  return value === null ? undefined : JSON.parse(value);
}

function toEntry(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    contestId: row.contest_id,
    actorId: row.actor_id,
    type: row.type,
    before: parseOrUndefined(row.before_json),
    after: parseOrUndefined(row.after_json),
    sourcePath: row.source_path as SourcePath,
    ...(row.tool_name !== null ? { toolName: row.tool_name } : {}),
    ...(row.tool_args !== null ? { toolArgs: parseOrUndefined(row.tool_args) } : {}),
    ...(row.confirmation !== null ? { confirmation: row.confirmation as 'host' | 'auto' } : {}),
    occurredAt: row.occurred_at,
  };
}

export class SqliteAuditLogRepository implements AuditLogRepository {
  constructor(private readonly db: Database) {}

  async append(entry: AuditEntry): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO audit_log
           (id, contest_id, actor_id, type, before_json, after_json, source_path, tool_name, tool_args, confirmation, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.id,
        entry.contestId,
        entry.actorId,
        entry.type,
        jsonOrNull(entry.before),
        jsonOrNull(entry.after),
        entry.sourcePath,
        entry.toolName ?? null,
        jsonOrNull(entry.toolArgs),
        entry.confirmation ?? null,
        entry.occurredAt,
      );
  }

  async findByContest(contestId: string): Promise<AuditEntry[]> {
    const rows = await this.db
      .prepare(`SELECT * FROM audit_log WHERE contest_id = ? ORDER BY occurred_at, id`)
      .all(contestId) as unknown as AuditRow[];
    return rows.map(toEntry);
  }

  async deleteByContest(contestId: string): Promise<void> {
    await this.db.prepare(`DELETE FROM audit_log WHERE contest_id = ?`).run(contestId);
  }
}
