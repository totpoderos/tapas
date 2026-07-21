import type { Clock } from '../../audit/audit-projection.js';
import type { ContestRepository } from '../../db/contest-repository.js';
import type { DishRepository } from '../../db/dish-repository.js';
import type { SubmitDishResult } from './shared.js';

export interface SubmitDishInput {
  readonly name: string;
  readonly description?: string;
}

export interface SubmitDishDeps {
  readonly contests: ContestRepository;
  readonly dishes: DishRepository;
  readonly clock: Clock;
}

/**
 * Records (or revises) the dish a cook brought. The dish is not chosen by the
 * caller — it is the materialized slot the participant submits for, found via
 * the compiled view's `submitterIds`. So a cook can only ever submit their own
 * dish, and partners who share a slot submit the same dish.
 */
export class SubmitDish {
  constructor(private readonly deps: SubmitDishDeps) {}

  execute(contestId: string, participantId: string, input: SubmitDishInput): SubmitDishResult {
    const name = input.name?.trim();
    if (!name)
      return { ok: false, error: { code: 'NAME_REQUIRED', message: 'A dish needs a name.' } };

    const contest = this.deps.contests.findById(contestId);
    if (contest && contest.status !== 'live') {
      return { ok: false, error: { code: 'CONTEST_CLOSED', message: 'This contest is closed.' } };
    }

    const slot = contest?.materialized.dishes.find((dish) =>
      dish.submitterIds.includes(participantId),
    );
    if (!slot) {
      return {
        ok: false,
        error: { code: 'NO_DISH_FOR_PARTICIPANT', message: 'You have no dish in this contest.' },
      };
    }

    const dish = {
      contestId,
      dishId: slot.id,
      name,
      description: input.description?.trim() || null,
      submitterIds: [...slot.submitterIds],
      submittedAt: this.deps.clock.now(),
    };
    this.deps.dishes.upsert(dish);
    return { ok: true, dish };
  }
}
