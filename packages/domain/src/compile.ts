import type {
  ContestDraft,
  DishId,
  MaterializedContest,
  MaterializedDish,
  Person,
  PersonId,
  ScoreBounds,
} from './model.js';

export type CompileErrorCode =
  | 'NO_PARTICIPANTS'
  | 'NO_CATEGORIES'
  | 'DUPLICATE_PERSON_ID'
  | 'DUPLICATE_CATEGORY_ID'
  | 'MISSING_PARTNER'
  | 'INCONSISTENT_PARTNER'
  | 'UNPARTNERED_IN_COUPLES'
  | 'INVALID_RANGE'
  | 'JUDGE_CANNOT_SCORE_ANY_DISH';

/**
 * The facts a refusal is about, apart from the sentence it is written into.
 *
 * A sentence is written in one language, and whoever reads it cannot put it into
 * another — so a panel that has to tell a Spanish-speaking host why their
 * contest will not go live needs the people and the categories as values, not
 * already glued into English. These are exactly the values the message
 * interpolates, under names its translations use.
 *
 * Data, never words: a display name and a category name are the host's own text
 * and are carried through untouched, to be shown inside whatever sentence the
 * reader writes around them.
 */
export type RefusalDetails = Readonly<Record<string, string | number | readonly string[]>>;

export interface CompileError {
  readonly code: CompileErrorCode;
  /**
   * English, and staying that way. It is the whole of what a reader with no
   * words of its own gets — a connected assistant, a log line, an API client —
   * so a screen with translations reads {@link CompileError.details} instead
   * rather than this being taken away from them.
   */
  readonly message: string;
  /** Absent when the refusal is about nothing in particular, which is a decision, not an omission. */
  readonly details?: RefusalDetails;
}

export type CompileResult =
  | { readonly ok: true; readonly contest: MaterializedContest }
  | { readonly ok: false; readonly error: CompileError };

function fail(code: CompileErrorCode, message: string, details?: RefusalDetails): CompileResult {
  return { ok: false, error: details ? { code, message, details } : { code, message } };
}

/**
 * Compiles a {@link ContestDraft} into a {@link MaterializedContest}, or returns
 * a typed error. Pure: no I/O, no clock, no randomness — deterministic for a
 * given draft. This is the load-bearing artifact (design.md §3).
 */
export function compile(draft: ContestDraft): CompileResult {
  const people = draft.participants;
  if (people.length === 0) return fail('NO_PARTICIPANTS', 'A contest needs at least one participant.');

  /*
   * A contest judged on nothing is not merely empty, it is broken in a way that
   * only shows at the end: its participants get a ballot with nothing to score,
   * every dish totals zero, and the reveal names all of them joint winners of a
   * contest nobody could take part in. A draft with no categories yet is an
   * ordinary halfway state; a published contest with none is not, which is why
   * this is checked here and not when the draft is written.
   */
  if (draft.scoring.categories.length === 0) {
    return fail('NO_CATEGORIES', 'A contest needs at least one thing to be judged on.');
  }

  /*
   * The same rule as duplicate participant ids below, for the other thing a
   * score points at. A score is kept against the category it was given for and
   * a total is gathered by matching it, so two categories that are one thing
   * underneath would each gather the other's scores — every total wrong, and
   * nothing between here and the reveal looking wrong. The contest would simply
   * announce a winner decided by doubled scores.
   *
   * The message names the categories rather than the id they share: a host
   * looking at two differently-named things needs to know which two are the
   * problem, and has never been shown an id.
   */
  const categoriesById = new Map<string, string>();
  for (const category of draft.scoring.categories) {
    const first = categoriesById.get(category.id);
    if (first !== undefined) {
      return fail(
        'DUPLICATE_CATEGORY_ID',
        `"${first}" and "${category.name}" are the same thing to be judged on, so they cannot both be scored.`,
        { first, second: category.name },
      );
    }
    categoriesById.set(category.id, category.name);
  }

  /*
   * The people half of the rule above, and it used to be the one that read
   * worse: `Duplicate participant id "p3f7a"` named the id the two share, which
   * is the one thing about them a host has never been seen and could not go
   * looking for. It names them the way the host named them, exactly as the
   * category version does — the code keeps its `_ID`, which is the defect's
   * name rather than what the host is told.
   */
  const byId = new Map<PersonId, Person>();
  for (const p of people) {
    const first = byId.get(p.id);
    if (first) {
      return fail(
        'DUPLICATE_PERSON_ID',
        `"${first.displayName}" and "${p.displayName}" are the same person taking part, so they cannot both be scored.`,
        { first: first.displayName, second: p.displayName },
      );
    }
    byId.set(p.id, p);
  }

  // Partner references must exist and be reciprocal.
  for (const p of people) {
    if (p.partnerId === undefined) continue;
    const partner = byId.get(p.partnerId);
    if (!partner) {
      return fail('MISSING_PARTNER', `"${p.displayName}" names a partner that is not a participant.`, {
        person: p.displayName,
      });
    }
    if (partner.partnerId !== p.id) {
      return fail('INCONSISTENT_PARTNER', `The partnership for "${p.displayName}" is not reciprocal.`, {
        person: p.displayName,
      });
    }
  }

  // The couples format is only for couples: there is no dish for somebody
  // without a partner to cook, and no couple for them to belong to.
  if (draft.format === 'couples') {
    for (const p of people) {
      if (p.partnerId === undefined) {
        return fail(
          'UNPARTNERED_IN_COUPLES',
          `"${p.displayName}" has no partner, and this contest is for couples.`,
          { person: p.displayName },
        );
      }
    }
  }

  const { range } = draft.scoring;
  if (range.type === 'fixed' && (range.min < 1 || range.max < range.min)) {
    return fail(
      'INVALID_RANGE',
      `Fixed score range 1-based and non-empty required (got ${range.min}..${range.max}).`,
      { min: range.min, max: range.max },
    );
  }

  const dishes = buildDishes(draft, people);

  const allowedVoters = new Map<DishId, ReadonlySet<PersonId>>();
  for (const dish of dishes) {
    const submitters = new Set(dish.submitterIds);
    const allowed = new Set<PersonId>();
    for (const p of people) {
      if (submitters.has(p.id)) continue; // never score your own dish
      if (isBarred(draft.format, p, submitters)) continue;
      allowed.add(p.id);
    }
    allowedVoters.set(dish.id, allowed);
  }

  // Every judge must be able to score at least one dish.
  const scoreableCount = new Map<PersonId, number>();
  for (const p of people) scoreableCount.set(p.id, 0);
  for (const dish of dishes) {
    for (const voter of allowedVoters.get(dish.id) ?? []) {
      scoreableCount.set(voter, (scoreableCount.get(voter) ?? 0) + 1);
    }
  }
  for (const p of people) {
    if ((scoreableCount.get(p.id) ?? 0) === 0) {
      return fail(
        'JUDGE_CANNOT_SCORE_ANY_DISH',
        `"${p.displayName}" would be able to score no dishes.`,
        { person: p.displayName },
      );
    }
  }

  const scoreRangeByVoter = new Map<PersonId, ScoreBounds>();
  for (const p of people) {
    const bounds: ScoreBounds =
      range.type === 'fixed'
        ? { min: range.min, max: range.max }
        : { min: 1, max: scoreableCount.get(p.id) ?? 0 };
    scoreRangeByVoter.set(p.id, bounds);
  }

  return {
    ok: true,
    contest: {
      dishes,
      allowedVoters,
      scoreRangeByVoter,
      uniquePerCategory: draft.scoring.uniquePerCategory,
      categories: [...draft.scoring.categories],
    },
  };
}

/**
 * What the format keeps from a judge *beyond* their own dish, which the caller
 * has already excluded.
 *
 * Only one format has anything to add. Under `couples` a judge's partner shares
 * their dish, so "never score your own dish" has already excluded it — the
 * fairness of a couples contest falls out of how its dishes are built rather
 * than from a rule that has to agree with them.
 */
function isBarred(
  format: ContestDraft['format'],
  voter: Person,
  submitters: ReadonlySet<PersonId>,
): boolean {
  return (
    format === 'solo_with_partners' &&
    voter.partnerId !== undefined &&
    submitters.has(voter.partnerId)
  );
}

function buildDishes(draft: ContestDraft, people: readonly Person[]): MaterializedDish[] {
  // Both solo formats cook one dish each; a partner under `solo` is a roster
  // fact the format has no use for, not a pairing that failed to apply.
  if (draft.format !== 'couples') {
    return people.map((p) => ({ id: `D-${p.id}`, submitterIds: [p.id] }));
  }

  // couples: partners share one dish. Everybody has a partner by the time we
  // get here, so there is no unpartnered case to fall back on.
  const dishes: MaterializedDish[] = [];
  const placed = new Set<PersonId>();
  for (const p of people) {
    if (placed.has(p.id) || p.partnerId === undefined) continue;
    const submitterIds = [p.id, p.partnerId];
    dishes.push({ id: `D-${submitterIds.join('-')}`, submitterIds });
    placed.add(p.id);
    placed.add(p.partnerId);
  }
  return dishes;
}
