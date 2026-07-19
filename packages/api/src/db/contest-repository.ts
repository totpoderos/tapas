import type { DatabaseSync } from 'node:sqlite';
import type { StoredContest } from '../contests/stored-contest.js';
import { deserializeMaterialized, serializeMaterialized } from '../contests/materialized-codec.js';

export interface ContestRepository {
  insert(contest: StoredContest): void;
  findById(id: string): StoredContest | undefined;
}

interface ContestRow {
  id: string;
  host_id: string;
  name: string;
  join_code: string;
  status: string;
  materialized: string;
  created_at: string;
}

function toContest(row: ContestRow): StoredContest {
  return {
    id: row.id,
    hostId: row.host_id,
    name: row.name,
    joinCode: row.join_code,
    status: row.status as 'live',
    materialized: deserializeMaterialized(row.materialized),
    createdAt: row.created_at,
  };
}

export class SqliteContestRepository implements ContestRepository {
  constructor(private readonly db: DatabaseSync) {}

  insert(contest: StoredContest): void {
    this.db
      .prepare(
        `INSERT INTO contests (id, host_id, name, join_code, status, materialized, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        contest.id,
        contest.hostId,
        contest.name,
        contest.joinCode,
        contest.status,
        serializeMaterialized(contest.materialized),
        contest.createdAt,
      );
  }

  findById(id: string): StoredContest | undefined {
    const row = this.db.prepare(`SELECT * FROM contests WHERE id = ?`).get(id) as unknown as
      | ContestRow
      | undefined;
    return row ? toContest(row) : undefined;
  }
}
