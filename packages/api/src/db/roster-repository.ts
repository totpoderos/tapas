import type { DatabaseSync } from 'node:sqlite';
import type { RosterPlace } from '../voters/roster-place.js';

/** A place to seed at publish time — the host-listed participant, not yet claimed. */
export interface RosterSeed {
  readonly participantId: string;
  readonly displayName: string;
}

export interface RosterRepository {
  /** Seeds a contest's roster at publish (all places start unclaimed). */
  seed(contestId: string, places: readonly RosterSeed[]): void;
  /** The places not yet claimed, in roster order. */
  listAvailable(contestId: string): RosterPlace[];
  find(contestId: string, participantId: string): RosterPlace | undefined;
  /** Atomically claims an open place; false if it does not exist or is already taken. */
  claim(contestId: string, participantId: string, claimedAt: string): boolean;
}

interface PersonRow {
  contest_id: string;
  participant_id: string;
  display_name: string;
  claimed_at: string | null;
}

function toPlace(row: PersonRow): RosterPlace {
  return {
    contestId: row.contest_id,
    participantId: row.participant_id,
    displayName: row.display_name,
    claimedAt: row.claimed_at,
  };
}

export class SqliteRosterRepository implements RosterRepository {
  constructor(private readonly db: DatabaseSync) {}

  seed(contestId: string, places: readonly RosterSeed[]): void {
    const insert = this.db.prepare(
      `INSERT INTO persons (contest_id, participant_id, display_name, claimed_at) VALUES (?, ?, ?, NULL)`,
    );
    for (const place of places) insert.run(contestId, place.participantId, place.displayName);
  }

  listAvailable(contestId: string): RosterPlace[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM persons WHERE contest_id = ? AND claimed_at IS NULL ORDER BY participant_id`,
      )
      .all(contestId) as unknown as PersonRow[];
    return rows.map(toPlace);
  }

  find(contestId: string, participantId: string): RosterPlace | undefined {
    const row = this.db
      .prepare(`SELECT * FROM persons WHERE contest_id = ? AND participant_id = ?`)
      .get(contestId, participantId) as unknown as PersonRow | undefined;
    return row ? toPlace(row) : undefined;
  }

  claim(contestId: string, participantId: string, claimedAt: string): boolean {
    const result = this.db
      .prepare(
        `UPDATE persons SET claimed_at = ? WHERE contest_id = ? AND participant_id = ? AND claimed_at IS NULL`,
      )
      .run(claimedAt, contestId, participantId);
    return result.changes === 1;
  }
}
