import { describe, expect, it } from 'vitest';
import { GetBallot, type StoredContest } from '../../../src/index.js';
import { FakeContestRepository } from '../contests/support.js';

function contestWith(materialized: StoredContest['materialized']): StoredContest {
  return {
    id: 'c1',
    hostId: 'host-1',
    name: 'Summer',
    joinCode: 'JOIN-1',
    status: 'live',
    materialized,
    closeRule: { when: 'host_trigger' },
    revealStrategy: { when: 'host_trigger' },
    createdAt: '2026-07-19T10:00:00.000Z',
    closedAt: null,
    revealedAt: null,
  };
}

/** Voter A may score dishes D-C and D-D; their own (D-A) and partner's (D-B) are barred. */
const materialized: StoredContest['materialized'] = {
  dishes: [
    { id: 'D-A', submitterIds: ['A'] },
    { id: 'D-B', submitterIds: ['B'] },
    { id: 'D-C', submitterIds: ['C'] },
    { id: 'D-D', submitterIds: ['D'] },
  ],
  allowedVoters: new Map([
    ['D-A', new Set(['C', 'D'])],
    ['D-B', new Set(['C', 'D'])],
    ['D-C', new Set(['A', 'B'])],
    ['D-D', new Set(['A', 'B'])],
  ]),
  scoreRangeByVoter: new Map([['A', { min: 1, max: 5 }]]),
  uniquePerCategory: false,
  categories: [{ id: 'c1', name: 'Taste' }],
};

const dishesRepo = {
  findByContest: () => [
    { contestId: 'c1', dishId: 'D-C', name: 'Tortilla', description: null, submitterIds: ['C'], submittedAt: 't' },
  ],
  insert: () => {},
  find: () => undefined,
};

/*
 * The roster is here for one reason: a dish nobody named is called by the cook
 * whose it is, so the names have to be resolvable. Nothing else about the
 * roster reaches the ballot.
 */
const rosterRepo = {
  listAll: () => [
    { contestId: 'c1', participantId: 'C', displayName: 'Carmen', claimedAt: null },
    { contestId: 'c1', participantId: 'D', displayName: 'Diego', claimedAt: null },
  ],
};

const ballotFor = (contests: FakeContestRepository, contestId: string, voterId: string) =>
  new GetBallot({ contests, dishes: dishesRepo as never, roster: rosterRepo as never }).execute(
    contestId,
    voterId,
  );

describe('GetBallot', () => {
  it('returns only the dishes open to the voter, with names, categories, range, and mode', () => {
    const contests = new FakeContestRepository();
    contests.insert(contestWith(materialized));

    const result = ballotFor(contests, 'c1', 'A');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { ballot } = result;
    expect(ballot.dishes.map((d) => d.dishId).sort()).toEqual(['D-C', 'D-D']);
    // Submitted names are used; a dish nobody named is called by its cook —
    // the same thing the reveal calls it, because it is the same function.
    expect(ballot.dishes.find((d) => d.dishId === 'D-C')?.name).toBe('Tortilla');
    expect(ballot.dishes.find((d) => d.dishId === 'D-D')?.name).toBe('Diego');
    expect(ballot.range).toEqual({ min: 1, max: 5 });
    expect(ballot.categories).toEqual([{ id: 'c1', name: 'Taste' }]);
    expect(ballot.uniquePerCategory).toBe(false);
  });

  it('reports CONTEST_NOT_FOUND for an unknown contest', () => {
    const result = ballotFor(new FakeContestRepository(), 'nope', 'A');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONTEST_NOT_FOUND');
  });
});
