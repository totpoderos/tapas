import type { DatabaseSync } from 'node:sqlite';
import type { StoredVoter } from '../voters/stored-voter.js';

export interface VoterRepository {
  insert(voter: StoredVoter): void;
  findById(id: string): StoredVoter | undefined;
}

interface VoterRow {
  id: string;
  contest_id: string;
  display_name: string;
  created_at: string;
}

function toVoter(row: VoterRow): StoredVoter {
  return {
    id: row.id,
    contestId: row.contest_id,
    displayName: row.display_name,
    createdAt: row.created_at,
  };
}

export class SqliteVoterRepository implements VoterRepository {
  constructor(private readonly db: DatabaseSync) {}

  insert(voter: StoredVoter): void {
    this.db
      .prepare(`INSERT INTO persons (id, contest_id, display_name, created_at) VALUES (?, ?, ?, ?)`)
      .run(voter.id, voter.contestId, voter.displayName, voter.createdAt);
  }

  findById(id: string): StoredVoter | undefined {
    const row = this.db.prepare(`SELECT * FROM persons WHERE id = ?`).get(id) as unknown as
      VoterRow | undefined;
    return row ? toVoter(row) : undefined;
  }
}
