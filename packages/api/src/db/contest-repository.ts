import type { DatabaseSync } from 'node:sqlite';
import type { CloseRule, RevealStrategy } from '@tapas/domain';
import type { StoredContest } from '../contests/stored-contest.js';
import { deserializeMaterialized, serializeMaterialized } from '../contests/materialized-codec.js';

export interface ContestRepository {
  insert(contest: StoredContest): void;
  findById(id: string): StoredContest | undefined;
  findByJoinCode(joinCode: string): StoredContest | undefined;
  /** Every contest a host owns, whatever its state — backs the host's contest list. */
  findByHost(hostId: string): StoredContest[];
  /** Persists a status transition (close/reveal) — the rest of a contest is immutable after publish. */
  updateStatus(
    id: string,
    status: StoredContest['status'],
    closedAt: string | null,
    revealedAt: string | null,
  ): void;
}

interface ContestRow {
  id: string;
  host_id: string;
  name: string;
  join_code: string;
  status: string;
  materialized: string;
  close_rule: string;
  reveal_strategy: string;
  created_at: string;
  closed_at: string | null;
  revealed_at: string | null;
}

function toContest(row: ContestRow): StoredContest {
  return {
    id: row.id,
    hostId: row.host_id,
    name: row.name,
    joinCode: row.join_code,
    status: row.status as StoredContest['status'],
    materialized: deserializeMaterialized(row.materialized),
    closeRule: JSON.parse(row.close_rule) as CloseRule,
    revealStrategy: JSON.parse(row.reveal_strategy) as RevealStrategy,
    createdAt: row.created_at,
    closedAt: row.closed_at,
    revealedAt: row.revealed_at,
  };
}

export class SqliteContestRepository implements ContestRepository {
  constructor(private readonly db: DatabaseSync) {}

  insert(contest: StoredContest): void {
    this.db
      .prepare(
        `INSERT INTO contests
           (id, host_id, name, join_code, status, materialized, close_rule, reveal_strategy, created_at, closed_at, revealed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        contest.id,
        contest.hostId,
        contest.name,
        contest.joinCode,
        contest.status,
        serializeMaterialized(contest.materialized),
        JSON.stringify(contest.closeRule),
        JSON.stringify(contest.revealStrategy),
        contest.createdAt,
        contest.closedAt,
        contest.revealedAt,
      );
  }

  findById(id: string): StoredContest | undefined {
    const row = this.db.prepare(`SELECT * FROM contests WHERE id = ?`).get(id) as unknown as
      ContestRow | undefined;
    return row ? toContest(row) : undefined;
  }

  findByJoinCode(joinCode: string): StoredContest | undefined {
    const row = this.db
      .prepare(`SELECT * FROM contests WHERE join_code = ?`)
      .get(joinCode) as unknown as ContestRow | undefined;
    return row ? toContest(row) : undefined;
  }

  findByHost(hostId: string): StoredContest[] {
    const rows = this.db
      .prepare(`SELECT * FROM contests WHERE host_id = ? ORDER BY created_at`)
      .all(hostId) as unknown as ContestRow[];
    return rows.map(toContest);
  }

  updateStatus(
    id: string,
    status: StoredContest['status'],
    closedAt: string | null,
    revealedAt: string | null,
  ): void {
    this.db
      .prepare(`UPDATE contests SET status = ?, closed_at = ?, revealed_at = ? WHERE id = ?`)
      .run(status, closedAt, revealedAt, id);
  }
}
