import { describe, expect, it } from 'vitest';
import type { TallyResult } from '@tapas/domain';
import { toRevealDto } from '../../../src/contests/reveal-dto.js';

const NAMES: Record<string, string> = { 'D-a': 'Patatas', 'D-b': 'Tortilla', 'D-c': 'Gazpacho' };
const categories = [{ id: 'taste', name: 'Taste' }];

describe('toRevealDto', () => {
  it('names the winners and orders the leaderboard highest first', () => {
    const results: TallyResult = {
      categories: [{ categoryId: 'taste', totals: new Map([['D-a', 3], ['D-b', 8], ['D-c', 5]]), winners: ['D-b'] }],
      overallTotals: new Map([['D-a', 3], ['D-b', 8], ['D-c', 5]]),
      overallWinners: ['D-b'],
    };

    const dto = toRevealDto('Summer Tapas', categories, results, (id) => NAMES[id] ?? id);

    expect(dto.contestName).toBe('Summer Tapas');
    expect(dto.overall.winners).toEqual([{ dishId: 'D-b', name: 'Tortilla' }]);
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

    const dto = toRevealDto('Tie Fest', categories, results, (id) => NAMES[id] ?? id);

    expect(dto.overall.winners.map((w) => w.name).sort()).toEqual(['Patatas', 'Tortilla']);
    expect(dto.categories[0]?.winners).toHaveLength(2);
  });
});
