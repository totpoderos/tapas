import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../../../src/db/migrate.js';
import { SqliteContestRepository } from '../../../src/db/contest-repository.js';
import type { StoredContest } from '../../../src/contests/stored-contest.js';

/**
 * The two rules the compiler consumes, kept on the contest row so a live contest
 * can still say what it is being played by.
 *
 * Against a real database, because the interesting case is the one the code path
 * cannot produce: a contest published before these columns existed. Publishing
 * requires both rules, so `NULL` only ever arrives from an older row — and what
 * it must mean is "this contest does not say", never a guess. A fake would have
 * let us assert that without ever writing a null.
 */
describe('the rules a contest keeps', () => {
  let db: DatabaseSync;
  let contests: SqliteContestRepository;

  const stored = (over: Partial<StoredContest> = {}): StoredContest => ({
    id: 'c1',
    hostId: 'host-1',
    name: 'Summer Tapeo',
    joinCode: 'JOIN-1',
    status: 'live',
    materialized: {
      dishes: [],
      allowedVoters: new Map(),
      scoreRangeByVoter: new Map(),
      uniquePerCategory: true,
      categories: [{ id: 'c1', name: 'Taste' }],
    },
    closeRule: { when: 'host_trigger' },
    revealStrategy: { when: 'host_trigger' },
    createdAt: '2026-07-30T10:00:00.000Z',
    closedAt: null,
    revealedAt: null,
    ...over,
  });

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    runMigrations(db);
    contests = new SqliteContestRepository(db);
  });

  it('reads back both rules a contest was published with', () => {
    contests.insert(stored({ attribution: 'per_couple', antiBias: 'arbitrary_pairs' }));

    const read = contests.findById('c1');
    expect(read?.attribution).toBe('per_couple');
    expect(read?.antiBias).toBe('arbitrary_pairs');
  });

  it('says nothing about the rules of a contest that recorded none', () => {
    // The shape of a row written before the columns existed.
    contests.insert(stored());

    const read = contests.findById('c1');
    expect(read).toBeDefined();
    expect(read).not.toHaveProperty('attribution');
    expect(read).not.toHaveProperty('antiBias');
  });

  it('does not read "no restriction" into a contest that simply does not say', () => {
    contests.insert(stored());

    // 'none' is a real anti-bias rule a host can choose, so it must never be what
    // an unrecorded rule looks like — that would tell the host something untrue
    // about how their own contest is being scored.
    expect(contests.findById('c1')?.antiBias).toBeUndefined();
  });

  it('keeps the rules through the host’s whole contest list', () => {
    contests.insert(stored({ attribution: 'per_person', antiBias: 'couples' }));

    const [listed] = contests.findByHost('host-1');
    expect(listed?.attribution).toBe('per_person');
    expect(listed?.antiBias).toBe('couples');
  });
});
