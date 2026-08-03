import type { Database } from './database.js';
import type { RosterPlace } from '../voters/roster-place.js';

/** A place to seed at publish time — the host-listed participant, not yet claimed. */
export interface RosterSeed {
  readonly participantId: string;
  readonly displayName: string;
}

export interface RosterRepository {
  /** Seeds a contest's roster at publish (all places start unclaimed). */
  seed(contestId: string, places: readonly RosterSeed[]): Promise<void>;
  /** The places not yet claimed, in roster order. */
  listAvailable(contestId: string): Promise<RosterPlace[]>;
  /** The places already claimed, in roster order — for checking whether everyone who joined has sent. */
  listClaimed(contestId: string): Promise<RosterPlace[]>;
  /** Every place, claimed or not, in roster order — the full set of participants the host listed. */
  listAll(contestId: string): Promise<RosterPlace[]>;
  /**
   * How many places are claimed in each of several contests at once, for the
   * host's contest list. One query for the whole list rather than one per
   * contest: a host with a dozen contests should not cost a dozen round trips to
   * draw one table. Contests with nothing claimed are simply absent from the map.
   */
  countClaimedByContest(contestIds: readonly string[]): Promise<Map<string, number>>;
  find(contestId: string, participantId: string): Promise<RosterPlace | undefined>;
  /** Atomically claims an open place; false if it does not exist or is already taken. */
  claim(contestId: string, participantId: string, claimedAt: string): Promise<boolean>;
  /** Removes every place in a contest — the display names go with it. */
  deleteByContest(contestId: string): Promise<void>;
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
  constructor(private readonly db: Database) {}

  async seed(contestId: string, places: readonly RosterSeed[]): Promise<void> {
    const insert = this.db.prepare(
      `INSERT INTO persons (contest_id, participant_id, display_name, claimed_at) VALUES (?, ?, ?, NULL)`,
    );
    for (const place of places) await insert.run(contestId, place.participantId, place.displayName);
  }

  async listAvailable(contestId: string): Promise<RosterPlace[]> {
    const rows = await this.db
      .prepare(
        `SELECT * FROM persons WHERE contest_id = ? AND claimed_at IS NULL ORDER BY participant_id`,
      )
      .all(contestId) as unknown as PersonRow[];
    return rows.map(toPlace);
  }

  async listClaimed(contestId: string): Promise<RosterPlace[]> {
    const rows = await this.db
      .prepare(
        `SELECT * FROM persons WHERE contest_id = ? AND claimed_at IS NOT NULL ORDER BY participant_id`,
      )
      .all(contestId) as unknown as PersonRow[];
    return rows.map(toPlace);
  }

  async listAll(contestId: string): Promise<RosterPlace[]> {
    const rows = await this.db
      .prepare(`SELECT * FROM persons WHERE contest_id = ? ORDER BY participant_id`)
      .all(contestId) as unknown as PersonRow[];
    return rows.map(toPlace);
  }

  async countClaimedByContest(contestIds: readonly string[]): Promise<Map<string, number>> {
    // `IN ()` is not valid SQL, so nothing to ask about means nothing to ask.
    if (contestIds.length === 0) return new Map();
    const placeholders = contestIds.map(() => '?').join(', ');
    const rows = await this.db
      .prepare(
        `SELECT contest_id, COUNT(*) AS claimed FROM persons
          WHERE contest_id IN (${placeholders}) AND claimed_at IS NOT NULL
          GROUP BY contest_id`,
      )
      .all(...contestIds) as unknown as { contest_id: string; claimed: number }[];
    return new Map(rows.map((row) => [row.contest_id, Number(row.claimed)]));
  }

  async find(contestId: string, participantId: string): Promise<RosterPlace | undefined> {
    const row = await this.db
      .prepare(`SELECT * FROM persons WHERE contest_id = ? AND participant_id = ?`)
      .get(contestId, participantId) as unknown as PersonRow | undefined;
    return row ? toPlace(row) : undefined;
  }

  async claim(contestId: string, participantId: string, claimedAt: string): Promise<boolean> {
    const result = await this.db
      .prepare(
        `UPDATE persons SET claimed_at = ? WHERE contest_id = ? AND participant_id = ? AND claimed_at IS NULL`,
      )
      .run(claimedAt, contestId, participantId);
    return result.changes === 1;
  }

  async deleteByContest(contestId: string): Promise<void> {
    await this.db.prepare(`DELETE FROM persons WHERE contest_id = ?`).run(contestId);
  }
}
