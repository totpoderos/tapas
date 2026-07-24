import type { Category, ScoreBounds } from '@tapas/domain';
import type { ContestRepository } from '../../db/contest-repository.js';
import type { DishRepository } from '../../db/dish-repository.js';

/** A dish a voter may score, with its submitted name. */
export interface BallotDish {
  readonly dishId: string;
  readonly name: string;
}

/**
 * A voter's ballot: everything they need to score, derived from the compiled
 * constraint view — the dishes open to them (their own and any anti-bias
 * exclusions already removed), the categories, the score range that applies to
 * them, and whether each category must be a strict ranking. This is the
 * voter-facing read the adaptive score screen renders so an invalid score is
 * impossible to enter.
 */
export interface Ballot {
  readonly contestId: string;
  readonly dishes: readonly BallotDish[];
  readonly categories: readonly Category[];
  readonly range: ScoreBounds;
  readonly uniquePerCategory: boolean;
}

export type GetBallotResult =
  | { readonly ok: true; readonly ballot: Ballot }
  | { readonly ok: false; readonly error: { readonly code: 'CONTEST_NOT_FOUND'; readonly message: string } };

export interface GetBallotDeps {
  readonly contests: ContestRepository;
  readonly dishes: DishRepository;
}

export class GetBallot {
  constructor(private readonly deps: GetBallotDeps) {}

  execute(contestId: string, voterId: string): GetBallotResult {
    const contest = this.deps.contests.findById(contestId);
    if (!contest)
      return { ok: false, error: { code: 'CONTEST_NOT_FOUND', message: 'No such contest.' } };

    const materialized = contest.materialized;
    const names = new Map(
      this.deps.dishes.findByContest(contestId).map((dish) => [dish.dishId, dish.name]),
    );
    const dishes = materialized.dishes
      .filter((dish) => materialized.allowedVoters.get(dish.id)?.has(voterId))
      .map((dish) => ({ dishId: dish.id, name: names.get(dish.id) ?? 'A dish (not named yet)' }));

    // A claimed voter with open dishes always has a range; fall back defensively.
    const range = materialized.scoreRangeByVoter.get(voterId) ?? { min: 1, max: 1 };

    return {
      ok: true,
      ballot: {
        contestId,
        dishes,
        categories: materialized.categories,
        range,
        uniquePerCategory: materialized.uniquePerCategory,
      },
    };
  }
}
