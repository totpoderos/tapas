import type { Database } from './database.js';
import type { DraftContent } from '@tapas/domain';
import type { StoredDraft } from '../drafts/stored-draft.js';

export interface DraftRepository {
  insert(draft: StoredDraft): Promise<void>;
  update(draft: StoredDraft): Promise<void>;
  findById(id: string): Promise<StoredDraft | undefined>;
  findByHost(hostId: string): Promise<StoredDraft[]>;
  delete(id: string): Promise<void>;
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
    status: row.status as 'draft',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteDraftRepository implements DraftRepository {
  constructor(private readonly db: Database) {}

  async insert(draft: StoredDraft): Promise<void> {
    await this.db
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

  async update(draft: StoredDraft): Promise<void> {
    await this.db
      .prepare(
        `UPDATE contest_drafts SET name = ?, content = ?, status = ?, updated_at = ? WHERE id = ?`,
      )
      .run(draft.content.name, JSON.stringify(draft.content), draft.status, draft.updatedAt, draft.id);
  }

  async findById(id: string): Promise<StoredDraft | undefined> {
    const row = await this.db.prepare(`SELECT * FROM contest_drafts WHERE id = ?`).get(id) as unknown as
      | DraftRow
      | undefined;
    return row ? toDraft(row) : undefined;
  }

  async findByHost(hostId: string): Promise<StoredDraft[]> {
    const rows = await this.db
      .prepare(`SELECT * FROM contest_drafts WHERE host_id = ? ORDER BY created_at`)
      .all(hostId) as unknown as DraftRow[];
    return rows.map(toDraft);
  }

  async delete(id: string): Promise<void> {
    await this.db.prepare(`DELETE FROM contest_drafts WHERE id = ?`).run(id);
  }
}
