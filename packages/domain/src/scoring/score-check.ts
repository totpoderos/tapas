import type { CategoryId, DishId, MaterializedContest, PersonId } from '../model.js';

export type ScoreCheckErrorCode = 'DISH_NOT_OPEN' | 'UNKNOWN_CATEGORY' | 'OUT_OF_RANGE';

export interface ScoreCheckError {
  readonly code: ScoreCheckErrorCode;
  readonly message: string;
}

export type ScoreCheckResult =
  { readonly ok: true } | { readonly ok: false; readonly error: ScoreCheckError };

export interface ScoreInput {
  readonly dishId: DishId;
  readonly categoryId: CategoryId;
  readonly value: number;
}

/**
 * Validates a score against the compiled constraint view — the rule language
 * is never re-interpreted at runtime, only this fixed view is consulted
 * (design.md §4/§11A). A pure function: no I/O, no persistence.
 */
export function checkScore(
  materialized: MaterializedContest,
  voterId: PersonId,
  input: ScoreInput,
): ScoreCheckResult {
  const allowed = materialized.allowedVoters.get(input.dishId);
  if (!allowed || !allowed.has(voterId)) {
    return {
      ok: false,
      error: { code: 'DISH_NOT_OPEN', message: 'That dish is not open to you.' },
    };
  }

  if (!materialized.categories.some((category) => category.id === input.categoryId)) {
    return { ok: false, error: { code: 'UNKNOWN_CATEGORY', message: 'No such category.' } };
  }

  const bounds = materialized.scoreRangeByVoter.get(voterId);
  if (!bounds || input.value < bounds.min || input.value > bounds.max) {
    return { ok: false, error: { code: 'OUT_OF_RANGE', message: 'That score is out of range.' } };
  }

  return { ok: true };
}
