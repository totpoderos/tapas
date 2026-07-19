/** Identifiers (opaque strings). */
export type PersonId = string;
export type DishId = string;
export type CategoryId = string;

/** How a dish is credited. */
export type Attribution = 'per_person' | 'per_couple';

/** Who may not score whom. */
export type AntiBias = 'none' | 'couples' | 'arbitrary_pairs';

export interface Category {
  readonly id: CategoryId;
  readonly name: string;
}

/**
 * The allowed score range. `fixed` is an explicit min..max; `auto` resolves,
 * per judge, to 1..(number of dishes that judge may score) — a ranking.
 */
export type ScoreRange = { readonly type: 'fixed'; readonly min: number; readonly max: number } | {
  readonly type: 'auto';
};

export interface ScoringConfig {
  readonly categories: readonly Category[];
  readonly range: ScoreRange;
  /** true = scores within a category must all differ (a permutation). */
  readonly uniquePerCategory: boolean;
}

/** A participant in the draft. `partnerId`/`noScoreWith` reference other participants. */
export interface Person {
  readonly id: PersonId;
  readonly displayName: string;
  readonly partnerId?: PersonId;
  readonly noScoreWith?: readonly PersonId[];
}

/** The compiler's input: the rule-space configuration plus the participants. */
export interface ContestDraft {
  readonly attribution: Attribution;
  readonly antiBias: AntiBias;
  readonly scoring: ScoringConfig;
  readonly participants: readonly Person[];
}

/** A dish produced by attribution (one submitter for per-person, two for a couple). */
export interface MaterializedDish {
  readonly id: DishId;
  readonly submitterIds: readonly PersonId[];
}

export interface ScoreBounds {
  readonly min: number;
  readonly max: number;
}

/**
 * The compiled constraint view. Consulted at runtime; the rule language is
 * never re-interpreted after this. Score bounds are per judge and uniform
 * across categories.
 */
export interface MaterializedContest {
  readonly dishes: readonly MaterializedDish[];
  readonly allowedVoters: ReadonlyMap<DishId, ReadonlySet<PersonId>>;
  readonly scoreRangeByVoter: ReadonlyMap<PersonId, ScoreBounds>;
  readonly uniquePerCategory: boolean;
  readonly categories: readonly Category[];
}
