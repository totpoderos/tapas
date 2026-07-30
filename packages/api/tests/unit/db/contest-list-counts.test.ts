import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../../../src/db/migrate.js';
import { SqliteRosterRepository } from '../../../src/db/roster-repository.js';
import { SqliteVoteSessionRepository } from '../../../src/db/vote-session-repository.js';

/**
 * The two batched counts behind the host's contest list, against a real database.
 *
 * They exist so that listing a host's contests costs one query each rather than
 * one per contest, and they run against real SQL because that is where the
 * grouping and the empty-list edge actually live — `IN ()` is not valid SQL, and
 * a fake would never have told us.
 */
describe('counting a whole contest list at once', () => {
  let db: DatabaseSync;
  let roster: SqliteRosterRepository;
  let voteSessions: SqliteVoteSessionRepository;

  const clock = { now: () => '2026-07-30T10:00:00.000Z' };

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    runMigrations(db);
    roster = new SqliteRosterRepository(db);
    voteSessions = new SqliteVoteSessionRepository(db, clock);
  });

  function session(contestId: string, voterId: string, status: 'draft' | 'sent') {
    voteSessions.createSession({
      id: `${contestId}-${voterId}`,
      contestId,
      voterId,
      status,
      createdAt: clock.now(),
      submittedAt: status === 'sent' ? clock.now() : null,
    });
  }

  describe('claimed places', () => {
    it('counts only the claimed places, per contest, in one ask', () => {
      roster.seed('c1', [
        { participantId: 'p1', displayName: 'Isabel' },
        { participantId: 'p2', displayName: 'Tomás' },
        { participantId: 'p3', displayName: 'Núria' },
      ]);
      roster.seed('c2', [{ participantId: 'q1', displayName: 'Pau' }]);
      roster.claim('c1', 'p1', clock.now());
      roster.claim('c1', 'p2', clock.now());
      roster.claim('c2', 'q1', clock.now());

      const counts = roster.countClaimedByContest(['c1', 'c2']);

      expect(counts.get('c1')).toBe(2); // p3 never claimed
      expect(counts.get('c2')).toBe(1);
    });

    it('leaves a contest with nothing claimed out of the answer', () => {
      roster.seed('c1', [{ participantId: 'p1', displayName: 'Isabel' }]);

      expect(roster.countClaimedByContest(['c1']).has('c1')).toBe(false);
    });

    it('says nothing about a contest it was not asked about', () => {
      roster.seed('c1', [{ participantId: 'p1', displayName: 'Isabel' }]);
      roster.claim('c1', 'p1', clock.now());

      expect(roster.countClaimedByContest(['c2']).has('c1')).toBe(false);
    });

    it('asks nothing when there is nothing to ask about', () => {
      // `IN ()` is a syntax error, so an empty list must never reach the database.
      expect(roster.countClaimedByContest([])).toEqual(new Map());
    });
  });

  describe('vote sessions', () => {
    it('splits drafted from sent, per contest, in one ask', () => {
      session('c1', 'p1', 'sent');
      session('c1', 'p2', 'sent');
      session('c1', 'p3', 'draft');
      session('c2', 'q1', 'draft');

      const counts = voteSessions.countSessionsByContest(['c1', 'c2']);

      expect(counts.get('c1')).toEqual({ draftCount: 1, sentCount: 2 });
      expect(counts.get('c2')).toEqual({ draftCount: 1, sentCount: 0 });
    });

    it('leaves a contest nobody has started voting in out of the answer', () => {
      session('c1', 'p1', 'sent');

      expect(voteSessions.countSessionsByContest(['c1', 'c2']).has('c2')).toBe(false);
    });

    it('asks nothing when there is nothing to ask about', () => {
      expect(voteSessions.countSessionsByContest([])).toEqual(new Map());
    });

    it('agrees with reading one contest’s sessions the long way', () => {
      session('c1', 'p1', 'sent');
      session('c1', 'p2', 'draft');
      session('c1', 'p3', 'draft');

      const sessions = voteSessions.listSessions('c1');
      const counts = voteSessions.countSessionsByContest(['c1']).get('c1');

      // The batched count and the per-contest read must never drift apart: the
      // control room uses one and the contest list uses the other, and a host
      // seeing two different numbers for the same contest would be right to
      // distrust both.
      expect(counts).toEqual({
        draftCount: sessions.filter((s) => s.status === 'draft').length,
        sentCount: sessions.filter((s) => s.status === 'sent').length,
      });
    });
  });
});
