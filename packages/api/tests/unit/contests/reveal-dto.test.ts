import { describe, expect, it } from 'vitest';
import type { MaterializedContest, TallyResult } from '@tapas/domain';
import { dishNaming, toRevealDto } from '../../../src/contests/reveal-dto.js';

const NAMES: Record<string, string> = { 'D-a': 'Patatas', 'D-b': 'Tortilla', 'D-c': 'Gazpacho' };
const categories = [{ id: 'taste', name: 'Taste' }];

/** Names only, no cooks — for the cases that are about ordering and ties. */
const naming = { nameOf: (id: string) => NAMES[id] ?? id, cooksOf: () => [] };

describe('toRevealDto', () => {
  it('names the winners and orders the leaderboard highest first', () => {
    const results: TallyResult = {
      categories: [{ categoryId: 'taste', totals: new Map([['D-a', 3], ['D-b', 8], ['D-c', 5]]), winners: ['D-b'] }],
      overallTotals: new Map([['D-a', 3], ['D-b', 8], ['D-c', 5]]),
      overallWinners: ['D-b'],
    };

    const dto = toRevealDto('Summer Tapas', categories, results, naming);

    expect(dto.contestName).toBe('Summer Tapas');
    expect(dto.overall.winners).toEqual([{ dishId: 'D-b', name: 'Tortilla', cooks: [] }]);
    // Leaderboard sorted by total desc, with names.
    expect(dto.overall.standings.map((s) => s.name)).toEqual(['Tortilla', 'Gazpacho', 'Patatas']);
    expect(dto.categories[0]?.name).toBe('Taste');
  });

  it('lists every dish of a tie as a joint winner', () => {
    const results: TallyResult = {
      categories: [{ categoryId: 'taste', totals: new Map([['D-a', 8], ['D-b', 8]]), winners: ['D-a', 'D-b'] }],
      overallTotals: new Map([['D-a', 8], ['D-b', 8]]),
      overallWinners: ['D-a', 'D-b'],
    };

    const dto = toRevealDto('Tie Fest', categories, results, naming);

    expect(dto.overall.winners.map((w) => w.name).sort()).toEqual(['Patatas', 'Tortilla']);
    expect(dto.categories[0]?.winners).toHaveLength(2);
  });

  it('names the cook beside each winning dish, and leaves the leaderboard to dishes', () => {
    const results: TallyResult = {
      categories: [{ categoryId: 'taste', totals: new Map([['D-a', 3], ['D-b', 8]]), winners: ['D-b'] }],
      overallTotals: new Map([['D-a', 3], ['D-b', 8]]),
      overallWinners: ['D-b'],
    };
    const withCooks = { nameOf: (id: string) => NAMES[id] ?? id, cooksOf: () => ['Bob'] };

    const dto = toRevealDto('Summer Tapas', categories, results, withCooks);

    expect(dto.overall.winners).toEqual([{ dishId: 'D-b', name: 'Tortilla', cooks: ['Bob'] }]);
    // A board that named everybody would be a list of who lost.
    expect(dto.overall.standings.every((standing) => !('cooks' in standing))).toBe(true);
  });
});

const materialized = (dishes: { id: string; submitterIds: string[] }[]): MaterializedContest => ({
  dishes,
  allowedVoters: new Map(),
  scoreRangeByVoter: new Map(),
  uniquePerCategory: false,
  categories: [{ id: 'taste', name: 'Taste' }],
});

describe('dishNaming', () => {
  it('names a dish by what it was submitted as, and its cook by the roster', () => {
    const named = dishNaming(
      materialized([{ id: 'D-ana', submitterIds: ['ana'] }]),
      [{ dishId: 'D-ana', name: 'Patatas bravas' }],
      [{ participantId: 'ana', displayName: 'Ana' }],
    );

    expect(named.nameOf('D-ana')).toBe('Patatas bravas');
    expect(named.cooksOf('D-ana')).toEqual(['Ana']);
  });

  it('names both cooks of a dish two people share', () => {
    const named = dishNaming(
      materialized([{ id: 'D-ana-bob', submitterIds: ['ana', 'bob'] }]),
      [{ dishId: 'D-ana-bob', name: 'Tortilla for two' }],
      [
        { participantId: 'ana', displayName: 'Ana' },
        { participantId: 'bob', displayName: 'Bob' },
      ],
    );

    expect(named.cooksOf('D-ana-bob')).toEqual(['Ana', 'Bob']);
  });

  /*
   * A dish slot exists for every place on the roster, whether or not anyone got
   * round to submitting one. Cooks come from the materialized dish for exactly
   * this reason: an unsubmitted dish still knows whose it was.
   */
  it('still knows whose a dish is when it was never submitted', () => {
    const named = dishNaming(
      materialized([{ id: 'D-carol', submitterIds: ['carol'] }]),
      [],
      [{ participantId: 'carol', displayName: 'Carol' }],
    );

    // And is called by her, rather than by an English phrase written into the
    // API that would reach a Spanish reveal untranslated.
    expect(named.nameOf('D-carol')).toBe('Carol');
    expect(named.cooksOf('D-carol')).toEqual(['Carol']);
  });

  it('calls a dish two people brought and never named by both their names', () => {
    const named = dishNaming(
      materialized([{ id: 'D-ana-bob', submitterIds: ['ana', 'bob'] }]),
      [],
      [
        { participantId: 'ana', displayName: 'Ana' },
        { participantId: 'bob', displayName: 'Bob' },
      ],
    );

    // Joined the way the reveal already joins cooks for its "brought by" line.
    expect(named.nameOf('D-ana-bob')).toBe('Ana & Bob');
  });

  /*
   * The last resort, and the only one left. A dish with neither a submitted
   * name nor a cook on the roster has nothing to be called — a dash carries no
   * language, so there is no string here that can arrive in the wrong one.
   */
  it('falls back to a dash where there is neither a name nor a cook', () => {
    const named = dishNaming(
      materialized([{ id: 'D-ghost', submitterIds: ['ghost'] }]),
      [],
      [],
    );

    expect(named.nameOf('D-ghost')).toBe('\u2014');
  });

  // A submitted name always wins: this fallback is for the absence of one.
  it('prefers the name the cook gave over the cook', () => {
    const named = dishNaming(
      materialized([{ id: 'D-carol', submitterIds: ['carol'] }]),
      [{ dishId: 'D-carol', name: 'Tortilla' }],
      [{ participantId: 'carol', displayName: 'Carol' }],
    );

    expect(named.nameOf('D-carol')).toBe('Tortilla');
  });

  it('names nobody for a dish whose cook is not on the roster', () => {
    const named = dishNaming(
      materialized([{ id: 'D-ghost', submitterIds: ['ghost'] }]),
      [{ dishId: 'D-ghost', name: 'Something' }],
      [],
    );

    // An id with no person behind it is dropped rather than printed raw.
    expect(named.cooksOf('D-ghost')).toEqual([]);
  });
});
