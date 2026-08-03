import { DatabaseSync } from 'node:sqlite';
import { SqliteDatabase } from '../../../src/db/sqlite-database.js';
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
describe('counting a whole contest list at once', async () => {
  let db: DatabaseSync;
  let roster: SqliteRosterRepository;
  let voteSessions: SqliteVoteSessionRepository;

  const clock = { now: () => '2026-07-30T10:00:00.000Z' };

  beforeEach(async () => {
    db = new DatabaseSync(':memory:');
    await runMigrations(new SqliteDatabase(db));
    roster = new SqliteRosterRepository(new SqliteDatabase(db));
    voteSessions = new SqliteVoteSessionRepository(new SqliteDatabase(db), clock);
  });

  async function session(contestId: string, voterId: string, status: 'draft' | 'sent') {
    await voteSessions.createSession({
      id: `${contestId}-${voterId}`,
      contestId,
      voterId,
      status,
      createdAt: clock.now(),
      submittedAt: status === 'sent' ? clock.now() : null,
    });
  }

  describe('claimed places', async () => {
    it('counts only the claimed places, per contest, in one ask', async () => {
      await roster.seed('c1', [
        { participantId: 'p1', displayName: 'Isabel' },
        { participantId: 'p2', displayName: 'Tomás' },
        { participantId: 'p3', displayName: 'Núria' },
      ]);
      await roster.seed('c2', [{ participantId: 'q1', displayName: 'Pau' }]);
      await roster.claim('c1', 'p1', clock.now());
      await roster.claim('c1', 'p2', clock.now());
      await roster.claim('c2', 'q1', clock.now());

      const counts = await roster.countClaimedByContest(['c1', 'c2']);

      expect(counts.get('c1')).toBe(2); // p3 never claimed
      expect(counts.get('c2')).toBe(1);
    });

    it('leaves a contest with nothing claimed out of the answer', async () => {
      await roster.seed('c1', [{ participantId: 'p1', displayName: 'Isabel' }]);

      expect((await roster.countClaimedByContest(['c1'])).has('c1')).toBe(false);
    });

    it('says nothing about a contest it was not asked about', async () => {
      await roster.seed('c1', [{ participantId: 'p1', displayName: 'Isabel' }]);
      await roster.claim('c1', 'p1', clock.now());

      expect((await roster.countClaimedByContest(['c2'])).has('c1')).toBe(false);
    });

    it('asks nothing when there is nothing to ask about', async () => {
      // `IN ()` is a syntax error, so an empty list must never reach the database.
      expect(await roster.countClaimedByContest([])).toEqual(new Map());
    });
  });

  describe('vote sessions', async () => {
    it('splits drafted from sent, per contest, in one ask', async () => {
      await session('c1', 'p1', 'sent');
      await session('c1', 'p2', 'sent');
      await session('c1', 'p3', 'draft');
      await session('c2', 'q1', 'draft');

      const counts = await voteSessions.countSessionsByContest(['c1', 'c2']);

      expect(counts.get('c1')).toEqual({ draftCount: 1, sentCount: 2 });
      expect(counts.get('c2')).toEqual({ draftCount: 1, sentCount: 0 });
    });

    it('leaves a contest nobody has started voting in out of the answer', async () => {
      await session('c1', 'p1', 'sent');

      expect((await voteSessions.countSessionsByContest(['c1', 'c2'])).has('c2')).toBe(false);
    });

    it('asks nothing when there is nothing to ask about', async () => {
      expect(await voteSessions.countSessionsByContest([])).toEqual(new Map());
    });

    it('agrees with reading one contest’s sessions the long way', async () => {
      await session('c1', 'p1', 'sent');
      await session('c1', 'p2', 'draft');
      await session('c1', 'p3', 'draft');

      const sessions = await voteSessions.listSessions('c1');
      const counts = (await voteSessions.countSessionsByContest(['c1'])).get('c1');

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
