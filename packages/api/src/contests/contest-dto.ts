import type { DishId, PersonId, ScoreBounds } from '@tapas/domain';
import type { StoredContest } from './stored-contest.js';

export interface MaterializedContestDto {
  readonly dishes: StoredContest['materialized']['dishes'];
  readonly allowedVoters: Record<DishId, readonly PersonId[]>;
  readonly scoreRangeByVoter: Record<PersonId, ScoreBounds>;
  readonly uniquePerCategory: boolean;
  readonly categories: StoredContest['materialized']['categories'];
}

export type ContestDto = Omit<StoredContest, 'materialized'> & {
  readonly materialized: MaterializedContestDto;
};

/**
 * `StoredContest.materialized` carries `Map`s (`allowedVoters`,
 * `scoreRangeByVoter`), which `JSON.stringify` silently empties — flatten
 * them for an HTTP response (same problem `results-dto.ts` fixes for tallies).
 */
export function toContestDto(contest: StoredContest): ContestDto {
  return {
    ...contest,
    materialized: {
      dishes: contest.materialized.dishes,
      allowedVoters: Object.fromEntries(
        [...contest.materialized.allowedVoters].map(([dishId, voters]) => [dishId, [...voters]]),
      ),
      scoreRangeByVoter: Object.fromEntries(contest.materialized.scoreRangeByVoter),
      uniquePerCategory: contest.materialized.uniquePerCategory,
      categories: contest.materialized.categories,
    },
  };
}
