import type { Database } from '../../../src/db/database.js';
import { freshDatabase } from '../../support/test-database.js';
import { beforeEach, describe, expect, it } from 'vitest';
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
describe('the rules a contest keeps', async () => {
  let database: Database;
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

  beforeEach(async () => {
    ({ database } = await freshDatabase());
    contests = new SqliteContestRepository(database);
  });

  it('reads back the format a contest was published with', async () => {
    await contests.insert(stored({ format: 'couples' }));

    expect((await contests.findById('c1'))?.format).toBe('couples');
  });

  it('says nothing about the format of a contest that recorded none', async () => {
    await contests.insert(stored());

    const read = await contests.findById('c1');
    expect(read).toBeDefined();
    expect(read).not.toHaveProperty('format');
  });

  it('does not read a format into a contest that simply does not say', async () => {
    await contests.insert(stored());

    // 'solo' is a real format a host can choose, so it must never be what an
    // unrecorded format looks like — that would tell the host something untrue
    // about how their own contest is being scored.
    expect((await contests.findById('c1'))?.format).toBeUndefined();
  });

  it('keeps the format through the host’s whole contest list', async () => {
    await contests.insert(stored({ format: 'solo_with_partners' }));

    const [listed] = await contests.findByHost('host-1');
    expect(listed?.format).toBe('solo_with_partners');
  });
});
