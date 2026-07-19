import type { DatabaseSync } from 'node:sqlite';
import type { DraftContent, DraftStatus, StoredDraft } from '@tapas/shared';

export interface DraftRepository {
  insert(draft: StoredDraft): void;
  update(draft: StoredDraft): void;
  findById(id: string): StoredDraft | undefined;
  findByHost(hostId: string): StoredDraft[];
  delete(id: string): void;
}

interface DraftRow {
  id: string;
  host_id: string;
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function toDraft(row: DraftRow): StoredDraft {
  return {
    id: row.id,
    hostId: row.host_id,
    content: JSON.parse(row.content) as DraftContent,
    status: row.status as DraftStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteDraftRepository implements DraftRepository {
  constructor(private readonly db: DatabaseSync) {}

  insert(draft: StoredDraft): void {
    this.db
      .prepare(
        `INSERT INTO contest_drafts (id, host_id, name, content, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        draft.id,
        draft.hostId,
        draft.content.name,
        JSON.stringify(draft.content),
        draft.status,
        draft.createdAt,
        draft.updatedAt,
      );
  }

  update(draft: StoredDraft): void {
    this.db
      .prepare(
        `UPDATE contest_drafts SET name = ?, content = ?, status = ?, updated_at = ? WHERE id = ?`,
      )
      .run(draft.content.name, JSON.stringify(draft.content), draft.status, draft.updatedAt, draft.id);
  }

  findById(id: string): StoredDraft | undefined {
    const row = this.db.prepare(`SELECT * FROM contest_drafts WHERE id = ?`).get(id) as unknown as
      | DraftRow
      | undefined;
    return row ? toDraft(row) : undefined;
  }

  findByHost(hostId: string): StoredDraft[] {
    const rows = this.db
      .prepare(`SELECT * FROM contest_drafts WHERE host_id = ? ORDER BY created_at`)
      .all(hostId) as unknown as DraftRow[];
    return rows.map(toDraft);
  }

  delete(id: string): void {
    this.db.prepare(`DELETE FROM contest_drafts WHERE id = ?`).run(id);
  }
}
