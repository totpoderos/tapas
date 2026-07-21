import { describe, expect, it } from 'vitest';
import { checkScore, type MaterializedContest } from '../../../src/index.js';

/** Ana may score Bob's dish, 1..5, one category "Taste". Ana's own dish scores no one. */
function materialized(): MaterializedContest {
  return {
    dishes: [
      { id: 'D-ana', submitterIds: ['ana'] },
      { id: 'D-bob', submitterIds: ['bob'] },
    ],
    allowedVoters: new Map([
      ['D-ana', new Set(['bob'])],
      ['D-bob', new Set(['ana'])],
    ]),
    scoreRangeByVoter: new Map([
      ['ana', { min: 1, max: 5 }],
      ['bob', { min: 1, max: 5 }],
    ]),
    uniquePerCategory: false,
    categories: [{ id: 'taste', name: 'Taste' }],
  };
}

describe('checkScore', () => {
  it('accepts a score for a dish open to the voter, within range, in a real category', () => {
    const result = checkScore(materialized(), 'ana', {
      dishId: 'D-bob',
      categoryId: 'taste',
      value: 4,
    });
    expect(result.ok).toBe(true);
  });

  it('refuses a dish not open to the voter (e.g. their own)', () => {
    const result = checkScore(materialized(), 'ana', {
      dishId: 'D-ana',
      categoryId: 'taste',
      value: 4,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DISH_NOT_OPEN');
  });

  it('refuses an unknown category', () => {
    const result = checkScore(materialized(), 'ana', {
      dishId: 'D-bob',
      categoryId: 'presentation',
      value: 4,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNKNOWN_CATEGORY');
  });

  it('refuses a score outside the allowed range', () => {
    const result = checkScore(materialized(), 'ana', {
      dishId: 'D-bob',
      categoryId: 'taste',
      value: 9,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('OUT_OF_RANGE');
  });

  it('refuses a voter with no range set at all', () => {
    const result = checkScore(materialized(), 'stranger', {
      dishId: 'D-bob',
      categoryId: 'taste',
      value: 4,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DISH_NOT_OPEN');
  });
});
