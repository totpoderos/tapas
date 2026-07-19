import { describe, expect, it } from 'vitest';
import { Contest, type DraftContent } from '../../../src/index.js';

function person(id: string, partnerId: string) {
  return { id, displayName: id, partnerId };
}

function completeContent(name: string): DraftContent {
  return {
    name,
    attribution: 'per_person',
    antiBias: 'couples',
    scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'auto' }, uniquePerCategory: true },
    participants: [person('A', 'B'), person('B', 'A'), person('C', 'D'), person('D', 'C')],
  };
}

describe('Contest.publish', () => {
  it('publishes a complete draft into a live contest with the given join code', () => {
    const result = Contest.publish({ id: 'draft-1', hostId: 'host-1', content: completeContent('Summer') }, 'JOIN-1');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contest.status).toBe('live');
    expect(result.contest.name).toBe('Summer');
    expect(result.contest.joinCode).toBe('JOIN-1');
    expect(result.contest.materialized.dishes).toHaveLength(4);
  });

  it('rejects a draft that has no scoring rules yet', () => {
    const result = Contest.publish({ id: 'draft-1', hostId: 'host-1', content: { name: 'Half-baked' } }, 'JOIN-1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INCOMPLETE_DRAFT');
  });

  it('surfaces a compiler rejection (a judge who could score nothing)', () => {
    const singleCouple: DraftContent = {
      name: 'Just us',
      attribution: 'per_person',
      antiBias: 'couples',
      scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'auto' }, uniquePerCategory: true },
      participants: [person('A', 'B'), person('B', 'A')],
    };

    const result = Contest.publish({ id: 'draft-1', hostId: 'host-1', content: singleCouple }, 'JOIN-1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('JUDGE_CANNOT_SCORE_ANY_DISH');
  });
});
