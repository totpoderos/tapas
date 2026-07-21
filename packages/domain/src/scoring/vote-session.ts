import type { CategoryId, DishId, MaterializedContest, PersonId } from '../model.js';
import type { ScoreInput } from './score-check.js';

export type VoteSessionStatus = 'draft' | 'sent';

export type VoteSessionErrorCode = 'ALREADY_SENT' | 'INCOMPLETE' | 'DUPLICATE_CATEGORY_VALUE';

export interface VoteSessionError {
  readonly code: VoteSessionErrorCode;
  readonly message: string;
}

export type SendResult =
  | { readonly ok: true; readonly session: VoteSession }
  | { readonly ok: false; readonly error: VoteSessionError };

/**
 * A voter's vote session — the real consistency boundary (design.md §4A):
 * uniqueness per (dish, category) is a storage-level invariant, per-score
 * range validity is {@link checkScore}, and the `draft -> sent` lock,
 * completeness, and the `uniquePerCategory` permutation check live here.
 * Immutable — `send` returns a new, sent `VoteSession` or a typed error.
 */
export class VoteSession {
  private constructor(
    readonly id: string,
    readonly contestId: string,
    readonly voterId: PersonId,
    readonly status: VoteSessionStatus,
    readonly createdAt: string,
    readonly submittedAt: string | null,
  ) {}

  static start(id: string, contestId: string, voterId: PersonId, nowIso: string): VoteSession {
    return new VoteSession(id, contestId, voterId, 'draft', nowIso, null);
  }

  static rehydrate(
    id: string,
    contestId: string,
    voterId: PersonId,
    status: VoteSessionStatus,
    createdAt: string,
    submittedAt: string | null,
  ): VoteSession {
    return new VoteSession(id, contestId, voterId, status, createdAt, submittedAt);
  }

  get isSent(): boolean {
    return this.status === 'sent';
  }

  /** Locks the session, having checked it is complete and (if required) each category is a valid ranking. */
  send(
    materialized: MaterializedContest,
    scores: readonly ScoreInput[],
    nowIso: string,
  ): SendResult {
    if (this.isSent) {
      return {
        ok: false,
        error: { code: 'ALREADY_SENT', message: 'This vote has already been sent.' },
      };
    }

    const dishIds = [...materialized.allowedVoters.entries()]
      .filter(([, voters]) => voters.has(this.voterId))
      .map(([dishId]) => dishId);

    const valuesByCategory = new Map<CategoryId, Map<DishId, number>>();
    for (const category of materialized.categories) valuesByCategory.set(category.id, new Map());
    for (const score of scores)
      valuesByCategory.get(score.categoryId)?.set(score.dishId, score.value);

    for (const category of materialized.categories) {
      const given = valuesByCategory.get(category.id) ?? new Map<DishId, number>();

      if (dishIds.some((dishId) => !given.has(dishId))) {
        return {
          ok: false,
          error: { code: 'INCOMPLETE', message: 'Score every dish before sending.' },
        };
      }

      if (
        materialized.uniquePerCategory &&
        !isPermutation(dishIds.map((dishId) => given.get(dishId)!))
      ) {
        return {
          ok: false,
          error: {
            code: 'DUPLICATE_CATEGORY_VALUE',
            message: 'Each score in this category must be used exactly once.',
          },
        };
      }
    }

    return {
      ok: true,
      session: new VoteSession(
        this.id,
        this.contestId,
        this.voterId,
        'sent',
        this.createdAt,
        nowIso,
      ),
    };
  }
}

/** True if `values` is exactly {1, ..., values.length}, each appearing once. */
function isPermutation(values: readonly number[]): boolean {
  const seen = new Set(values);
  if (seen.size !== values.length) return false;
  for (let expected = 1; expected <= values.length; expected++) {
    if (!seen.has(expected)) return false;
  }
  return true;
}
