import type { MaterializedContest, MaterializedDish } from '@tapas/domain';
import { describe, expect, it } from 'vitest';
import { SubmitDish, type Clock } from '../../../../src/index.js';
import { FakeContestRepository } from '../../contests/support.js';
import { FakeDishRepository } from '../support.js';

const clock: Clock = { now: () => '2026-07-21T10:00:00.000Z' };

function materializedWith(dishes: MaterializedDish[]): MaterializedContest {
  return {
    dishes,
    allowedVoters: new Map(),
    scoreRangeByVoter: new Map(),
    uniquePerCategory: false,
    categories: [],
  };
}

function contestWithDishes(id: string, dishes: MaterializedDish[]) {
  return {
    id,
    hostId: 'host-1',
    name: 'Tapas Night',
    joinCode: 'TAPAS1',
    status: 'live' as const,
    materialized: materializedWith(dishes),
    createdAt: '2026-07-20T10:00:00.000Z',
    closeRule: { when: 'host_trigger' } as const,
    revealStrategy: { when: 'host_trigger' } as const,
    closedAt: null,
    revealedAt: null,
  };
}

function makeEnv(dishes: MaterializedDish[]) {
  const contests = new FakeContestRepository();
  contests.insert(contestWithDishes('contest-1', dishes));
  const dishRepo = new FakeDishRepository();
  return {
    submitDish: new SubmitDish({ contests, dishes: dishRepo, clock }),
    dishRepo,
    contests,
  };
}

describe('SubmitDish', () => {
  it("records a cook's dish against their materialized slot", () => {
    const { submitDish, dishRepo } = makeEnv([{ id: 'D-ana', submitterIds: ['ana'] }]);

    const outcome = submitDish.execute('contest-1', 'ana', { name: 'Patatas bravas' });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.dish.dishId).toBe('D-ana');
    expect(dishRepo.findByContest('contest-1')).toHaveLength(1);
  });

  it('revises the same dish rather than adding a second', () => {
    const { submitDish, dishRepo } = makeEnv([{ id: 'D-ana', submitterIds: ['ana'] }]);

    submitDish.execute('contest-1', 'ana', { name: 'Patatas bravas' });
    submitDish.execute('contest-1', 'ana', { name: 'Patatas bravas picantes' });

    const dishes = dishRepo.findByContest('contest-1');
    expect(dishes).toHaveLength(1);
    expect(dishes[0]?.name).toBe('Patatas bravas picantes');
  });

  it('rejects a dish with no name', () => {
    const { submitDish } = makeEnv([{ id: 'D-ana', submitterIds: ['ana'] }]);

    const outcome = submitDish.execute('contest-1', 'ana', { name: '   ' });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('NAME_REQUIRED');
  });

  it("lets either partner submit the couple's shared dish", () => {
    const { submitDish, dishRepo } = makeEnv([
      { id: 'D-ana-marcos', submitterIds: ['ana', 'marcos'] },
    ]);

    const outcome = submitDish.execute('contest-1', 'marcos', { name: 'Tortilla' });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.dish.dishId).toBe('D-ana-marcos');
      expect(outcome.dish.submitterIds).toEqual(['ana', 'marcos']);
    }
    // Ana submits for the same slot — still one dish, updated.
    submitDish.execute('contest-1', 'ana', { name: 'Tortilla de patatas' });
    const dishes = dishRepo.findByContest('contest-1');
    expect(dishes).toHaveLength(1);
    expect(dishes[0]?.name).toBe('Tortilla de patatas');
  });

  it('refuses a participant who has no dish slot', () => {
    const { submitDish } = makeEnv([{ id: 'D-ana', submitterIds: ['ana'] }]);

    const outcome = submitDish.execute('contest-1', 'stranger', { name: 'Gazpacho' });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('NO_DISH_FOR_PARTICIPANT');
  });

  it('refuses a submission once the contest has closed', () => {
    const { submitDish, contests } = makeEnv([{ id: 'D-ana', submitterIds: ['ana'] }]);
    contests.updateStatus('contest-1', 'closed', clock.now(), null);

    const outcome = submitDish.execute('contest-1', 'ana', { name: 'Patatas bravas' });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('CONTEST_CLOSED');
  });
});
