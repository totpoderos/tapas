import type { DatabaseSync } from 'node:sqlite';
import type { Clock } from '../audit/audit-projection.js';
import type { StoredScore, StoredVoteSession } from '../scoring/stored-vote-session.js';

/** Vote sessions in one contest, split by whether they have been sent. */
export interface SessionCounts {
  readonly draftCount: number;
  readonly sentCount: number;
}

export interface VoteSessionRepository {
  findSession(contestId: string, voterId: string): StoredVoteSession | undefined;
  createSession(session: StoredVoteSession): void;
  /** Marks a session sent, recording when. */
  markSent(voteSessionId: string, submittedAt: string): void;
  findScore(voteSessionId: string, dishId: string, categoryId: string): StoredScore | undefined;
  /** Inserts or updates a score by (voteSessionId, dishId, categoryId) — a judge may revise a draft score. */
  upsertScore(score: StoredScore): void;
  listScores(voteSessionId: string): StoredScore[];
  /** Every score belonging to a `sent` session in this contest — draft (unsent) votes never count toward a tally. */
  listSentScores(contestId: string): StoredScore[];
  /** Every vote session in this contest, any status — for the live draft/sent progress tally. */
  listSessions(contestId: string): StoredVoteSession[];
  /**
   * How many votes are drafted and how many sent, in each of several contests at
   * once, for the host's contest list. One query for the whole list rather than
   * one per contest. Contests with no sessions are simply absent from the map.
   */
  countSessionsByContest(contestIds: readonly string[]): Map<string, SessionCounts>;
  /** Removes every vote session in a contest and all the scores inside them. */
  deleteByContest(contestId: string): void;
}

interface SessionRow {
  id: string;
  contest_id: string;
  voter_id: string;
  status: string;
  created_at: string;
  submitted_at: string | null;
}

interface ScoreRow {
  id: string;
  vote_session_id: string;
  dish_id: string;
  category_id: string;
  value: number;
}

function toSession(row: SessionRow): StoredVoteSession {
  return {
    id: row.id,
    contestId: row.contest_id,
    voterId: row.voter_id,
    status: row.status as StoredVoteSession['status'],
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
  };
}

function toScore(row: ScoreRow): StoredScore {
  return {
    id: row.id,
    voteSessionId: row.vote_session_id,
    dishId: row.dish_id,
    categoryId: row.category_id,
    value: row.value,
  };
}

export class SqliteVoteSessionRepository implements VoteSessionRepository {
  constructor(
    private readonly db: DatabaseSync,
    private readonly clock: Clock,
  ) {}

  findSession(contestId: string, voterId: string): StoredVoteSession | undefined {
    const row = this.db
      .prepare(`SELECT * FROM vote_sessions WHERE contest_id = ? AND voter_id = ?`)
      .get(contestId, voterId) as unknown as SessionRow | undefined;
    return row ? toSession(row) : undefined;
  }

  createSession(session: StoredVoteSession): void {
    this.db
      .prepare(
        `INSERT INTO vote_sessions (id, contest_id, voter_id, status, created_at, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        session.id,
        session.contestId,
        session.voterId,
        session.status,
        session.createdAt,
        session.submittedAt,
      );
  }

  markSent(voteSessionId: string, submittedAt: string): void {
    this.db
      .prepare(`UPDATE vote_sessions SET status = 'sent', submitted_at = ? WHERE id = ?`)
      .run(submittedAt, voteSessionId);
  }

  findScore(voteSessionId: string, dishId: string, categoryId: string): StoredScore | undefined {
    const row = this.db
      .prepare(`SELECT * FROM scores WHERE vote_session_id = ? AND dish_id = ? AND category_id = ?`)
      .get(voteSessionId, dishId, categoryId) as unknown as ScoreRow | undefined;
    return row ? toScore(row) : undefined;
  }

  upsertScore(score: StoredScore): void {
    const now = this.clock.now();
    this.db
      .prepare(
        `INSERT INTO scores (id, vote_session_id, dish_id, category_id, value, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (vote_session_id, dish_id, category_id) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at`,
      )
      .run(score.id, score.voteSessionId, score.dishId, score.categoryId, score.value, now, now);
  }

  listScores(voteSessionId: string): StoredScore[] {
    const rows = this.db
      .prepare(`SELECT * FROM scores WHERE vote_session_id = ? ORDER BY dish_id, category_id`)
      .all(voteSessionId) as unknown as ScoreRow[];
    return rows.map(toScore);
  }

  listSentScores(contestId: string): StoredScore[] {
    const rows = this.db
      .prepare(
        `SELECT scores.* FROM scores
         JOIN vote_sessions ON vote_sessions.id = scores.vote_session_id
         WHERE vote_sessions.contest_id = ? AND vote_sessions.status = 'sent'
         ORDER BY scores.dish_id, scores.category_id`,
      )
      .all(contestId) as unknown as ScoreRow[];
    return rows.map(toScore);
  }

  listSessions(contestId: string): StoredVoteSession[] {
    const rows = this.db
      .prepare(`SELECT * FROM vote_sessions WHERE contest_id = ? ORDER BY voter_id`)
      .all(contestId) as unknown as SessionRow[];
    return rows.map(toSession);
  }

  countSessionsByContest(contestIds: readonly string[]): Map<string, SessionCounts> {
    // `IN ()` is not valid SQL, so nothing to ask about means nothing to ask.
    if (contestIds.length === 0) return new Map();
    const placeholders = contestIds.map(() => '?').join(', ');
    const rows = this.db
      .prepare(
        `SELECT contest_id, status, COUNT(*) AS howMany FROM vote_sessions
          WHERE contest_id IN (${placeholders})
          GROUP BY contest_id, status`,
      )
      .all(...contestIds) as unknown as {
      contest_id: string;
      status: string;
      howMany: number;
    }[];

    const counts = new Map<string, SessionCounts>();
    for (const row of rows) {
      const soFar = counts.get(row.contest_id) ?? { draftCount: 0, sentCount: 0 };
      counts.set(row.contest_id, {
        draftCount: soFar.draftCount + (row.status === 'draft' ? Number(row.howMany) : 0),
        sentCount: soFar.sentCount + (row.status === 'sent' ? Number(row.howMany) : 0),
      });
    }
    return counts;
  }

  /**
   * Scores are keyed by vote session, not by contest, so they go first — there is
   * no foreign key doing it for us, and deleting the sessions first would orphan
   * every score in the contest.
   */
  deleteByContest(contestId: string): void {
    this.db
      .prepare(
        `DELETE FROM scores WHERE vote_session_id IN
           (SELECT id FROM vote_sessions WHERE contest_id = ?)`,
      )
      .run(contestId);
    this.db.prepare(`DELETE FROM vote_sessions WHERE contest_id = ?`).run(contestId);
  }
}
