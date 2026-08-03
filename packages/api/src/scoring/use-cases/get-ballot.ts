import type { Category, ScoreBounds } from '@tapas/domain';
import type { ContestRepository } from '../../db/contest-repository.js';
import type { DishRepository } from '../../db/dish-repository.js';
import type { RosterRepository } from '../../db/roster-repository.js';
import { dishNaming } from '../../contests/reveal-dto.js';

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
  /**
   * Only so a dish nobody named can be called by the cook whose it is. The
   * ballot says nothing else about the roster — who may score what still comes
   * from the compiled constraint view and from nowhere else.
   */
  readonly roster: RosterRepository;
}

export class GetBallot {
  constructor(private readonly deps: GetBallotDeps) {}

  async execute(contestId: string, voterId: string): Promise<GetBallotResult> {
    const contest = await this.deps.contests.findById(contestId);
    if (!contest)
      return { ok: false, error: { code: 'CONTEST_NOT_FOUND', message: 'No such contest.' } };

    const materialized = contest.materialized;
    /*
     * The same naming both reveal routes use, rather than a second map and a
     * second placeholder of its own.
     *
     * This screen built its own until now, and the two had already drifted: the
     * reveal called an unnamed dish `A dish` and the ballot called it `A dish
     * (not named yet)`. A participant scores a dish on one screen and reads its
     * total on the other, so a dish that changes its name in between is a dish
     * they cannot follow. Two paths describing the same thing and agreeing by
     * convention is this repo's recurring defect; there is one path now.
     */
    const naming = dishNaming(
      materialized,
      await this.deps.dishes.findByContest(contestId),
      await this.deps.roster.listAll(contestId),
    );
    const dishes = materialized.dishes
      .filter((dish) => materialized.allowedVoters.get(dish.id)?.has(voterId))
      .map((dish) => ({ dishId: dish.id, name: naming.nameOf(dish.id) }));

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
