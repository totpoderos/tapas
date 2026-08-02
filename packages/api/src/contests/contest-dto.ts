import type { DishId, PersonId, ScoreBounds } from '@tapas/domain';
import type { StoredContest } from './stored-contest.js';
import { joinLinkFor } from './join-link.js';

export interface MaterializedContestDto {
  readonly dishes: StoredContest['materialized']['dishes'];
  readonly allowedVoters: Record<DishId, readonly PersonId[]>;
  readonly scoreRangeByVoter: Record<PersonId, ScoreBounds>;
  readonly uniquePerCategory: boolean;
  readonly categories: StoredContest['materialized']['categories'];
}

export type ContestDto = Omit<StoredContest, 'materialized'> & {
  readonly materialized: MaterializedContestDto;
  /**
   * Where the participant app answers for this contest's join code — what the
   * host panel turns into a scannable code, so a scan lands on the joining
   * screen with the code already entered.
   */
  readonly joinUrl: string;
};

/**
 * `StoredContest.materialized` carries `Map`s (`allowedVoters`,
 * `scoreRangeByVoter`), which `JSON.stringify` silently empties — flatten
 * them for an HTTP response (same problem `results-dto.ts` fixes for tallies).
 *
 * The join link is composed here rather than stored, because it is a deployment
 * fact and not a fact about the contest: the same contest read from two
 * deployments has two different links, so `participantWebOrigin` arrives from the
 * environment on every call. This is also the one seam every host-facing read of
 * a whole contest passes through — by id, by name, and the close and reveal
 * answers — which is what keeps those four from disagreeing.
 */
export function toContestDto(contest: StoredContest, participantWebOrigin: string): ContestDto {
  return {
    ...contest,
    joinUrl: joinLinkFor(participantWebOrigin, contest.joinCode),
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
