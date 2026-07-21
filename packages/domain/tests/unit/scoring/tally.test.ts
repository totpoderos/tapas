import { describe, expect, it } from 'vitest';
import { tally, type TallyEntry } from '../../../src/index.js';
import type { MaterializedContest } from '../../../src/model.js';

/** Ana and Bob's dishes, scored 1..5 in "Taste" and "Presentation". */
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
    categories: [
      { id: 'taste', name: 'Taste' },
      { id: 'presentation', name: 'Presentation' },
    ],
  };
}

describe('tally', () => {
  it('sums each judge\'s score per dish per category', () => {
    const entries: TallyEntry[] = [
      { dishId: 'D-ana', categoryId: 'taste', value: 4 },
      { dishId: 'D-bob', categoryId: 'taste', value: 3 },
      { dishId: 'D-ana', categoryId: 'presentation', value: 5 },
      { dishId: 'D-bob', categoryId: 'presentation', value: 2 },
    ];

    const result = tally(materialized(), entries);

    const taste = result.categories.find((c) => c.categoryId === 'taste');
    expect(taste?.totals.get('D-ana')).toBe(4);
    expect(taste?.totals.get('D-bob')).toBe(3);
    expect(taste?.winners).toEqual(['D-ana']);
  });

  it('sums multiple scores for the same dish in the same category', () => {
    const entries: TallyEntry[] = [
      { dishId: 'D-ana', categoryId: 'taste', value: 4 },
      { dishId: 'D-ana', categoryId: 'taste', value: 5 },
      { dishId: 'D-bob', categoryId: 'taste', value: 3 },
    ];

    const result = tally(materialized(), entries);

    const taste = result.categories.find((c) => c.categoryId === 'taste');
    expect(taste?.totals.get('D-ana')).toBe(9);
  });

  it('reports every dish tied for the top total as a joint winner', () => {
    const entries: TallyEntry[] = [
      { dishId: 'D-ana', categoryId: 'taste', value: 4 },
      { dishId: 'D-bob', categoryId: 'taste', value: 4 },
    ];

    const result = tally(materialized(), entries);

    const taste = result.categories.find((c) => c.categoryId === 'taste');
    expect([...(taste?.winners ?? [])].sort()).toEqual(['D-ana', 'D-bob']);
  });

  it('computes an overall winner by summing across every category', () => {
    const entries: TallyEntry[] = [
      { dishId: 'D-ana', categoryId: 'taste', value: 5 },
      { dishId: 'D-ana', categoryId: 'presentation', value: 5 },
      { dishId: 'D-bob', categoryId: 'taste', value: 4 },
      { dishId: 'D-bob', categoryId: 'presentation', value: 4 },
    ];

    const result = tally(materialized(), entries);

    expect(result.overallTotals.get('D-ana')).toBe(10);
    expect(result.overallTotals.get('D-bob')).toBe(8);
    expect(result.overallWinners).toEqual(['D-ana']);
  });

  it('gives a dish with no scores a total of zero, not an absence', () => {
    const result = tally(materialized(), []);

    const taste = result.categories.find((c) => c.categoryId === 'taste');
    expect(taste?.totals.get('D-ana')).toBe(0);
    expect(taste?.totals.get('D-bob')).toBe(0);
    expect([...(taste?.winners ?? [])].sort()).toEqual(['D-ana', 'D-bob']);
  });
});
