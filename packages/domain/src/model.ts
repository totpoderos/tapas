/** Identifiers (opaque strings). */
export type PersonId = string;
export type DishId = string;
export type CategoryId = string;

/**
 * What kind of contest this is: who cooks a dish, and who may not score it.
 *
 * One value settles both, so there is no second rule to agree with and no
 * combination to reason about — every format here is a contest somebody holds:
 *
 * - `solo` — each person cooks their own dish; everybody scores every dish but
 *   their own.
 * - `solo_with_partners` — each person cooks their own dish; a partner is
 *   optional, and whoever has one does not score their partner's dish.
 * - `couples` — each couple cooks one dish between them and everybody has a
 *   partner. Nothing needs barring: the partner's dish *is* the judge's own
 *   dish, which nobody may score in any format.
 */
export type ContestFormat = 'solo' | 'solo_with_partners' | 'couples';

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

/**
 * A participant in the draft. `partnerId` references another participant, and
 * must be reciprocal. A partner is the only way two people are kept apart.
 */
export interface Person {
  readonly id: PersonId;
  readonly displayName: string;
  readonly partnerId?: PersonId;
}

/** The compiler's input: the rule-space configuration plus the participants. */
export interface ContestDraft {
  readonly format: ContestFormat;
  readonly scoring: ScoringConfig;
  readonly participants: readonly Person[];
}

/** A dish the format produced: one submitter under either solo format, two under couples. */
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
