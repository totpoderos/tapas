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
  | 'DUPLICATE_PERSON_ID'
  | 'MISSING_PARTNER'
  | 'INCONSISTENT_PARTNER'
  | 'INVALID_RANGE'
  | 'JUDGE_CANNOT_SCORE_ANY_DISH';

export interface CompileError {
  readonly code: CompileErrorCode;
  readonly message: string;
}

export type CompileResult =
  | { readonly ok: true; readonly contest: MaterializedContest }
  | { readonly ok: false; readonly error: CompileError };

function fail(code: CompileErrorCode, message: string): CompileResult {
  return { ok: false, error: { code, message } };
}

/**
 * Compiles a {@link ContestDraft} into a {@link MaterializedContest}, or returns
 * a typed error. Pure: no I/O, no clock, no randomness — deterministic for a
 * given draft. This is the load-bearing artifact (design.md §3).
 */
export function compile(draft: ContestDraft): CompileResult {
  const people = draft.participants;
  if (people.length === 0) return fail('NO_PARTICIPANTS', 'A contest needs at least one participant.');

  const byId = new Map<PersonId, Person>();
  for (const p of people) {
    if (byId.has(p.id)) return fail('DUPLICATE_PERSON_ID', `Duplicate participant id "${p.id}".`);
    byId.set(p.id, p);
  }

  // Partner references must exist and be reciprocal.
  for (const p of people) {
    if (p.partnerId === undefined) continue;
    const partner = byId.get(p.partnerId);
    if (!partner) {
      return fail('MISSING_PARTNER', `"${p.displayName}" names a partner that is not a participant.`);
    }
    if (partner.partnerId !== p.id) {
      return fail('INCONSISTENT_PARTNER', `The partnership for "${p.displayName}" is not reciprocal.`);
    }
  }

  const { range } = draft.scoring;
  if (range.type === 'fixed' && (range.min < 1 || range.max < range.min)) {
    return fail('INVALID_RANGE', `Fixed score range 1-based and non-empty required (got ${range.min}..${range.max}).`);
  }

  const dishes = buildDishes(draft, people);

  // Symmetric "may not score" relation, only for arbitrary_pairs.
  const noScore = new Map<PersonId, Set<PersonId>>();
  const link = (a: PersonId, b: PersonId): void => {
    let set = noScore.get(a);
    if (!set) {
      set = new Set();
      noScore.set(a, set);
    }
    set.add(b);
  };
  if (draft.antiBias === 'arbitrary_pairs') {
    for (const p of people) {
      for (const other of p.noScoreWith ?? []) {
        if (!byId.has(other)) continue;
        link(p.id, other);
        link(other, p.id);
      }
    }
  }

  const allowedVoters = new Map<DishId, ReadonlySet<PersonId>>();
  for (const dish of dishes) {
    const submitters = new Set(dish.submitterIds);
    const allowed = new Set<PersonId>();
    for (const p of people) {
      if (submitters.has(p.id)) continue; // never score your own dish
      if (isBarred(draft.antiBias, p, submitters, noScore)) continue;
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

function isBarred(
  antiBias: ContestDraft['antiBias'],
  voter: Person,
  submitters: ReadonlySet<PersonId>,
  noScore: ReadonlyMap<PersonId, ReadonlySet<PersonId>>,
): boolean {
  switch (antiBias) {
    case 'none':
      return false;
    case 'couples':
      return voter.partnerId !== undefined && submitters.has(voter.partnerId);
    case 'arbitrary_pairs': {
      const barred = noScore.get(voter.id);
      if (!barred) return false;
      for (const s of submitters) if (barred.has(s)) return true;
      return false;
    }
  }
}

function buildDishes(draft: ContestDraft, people: readonly Person[]): MaterializedDish[] {
  if (draft.attribution === 'per_person') {
    return people.map((p) => ({ id: `D-${p.id}`, submitterIds: [p.id] }));
  }

  // per_couple: partners share one dish; singles get their own.
  const dishes: MaterializedDish[] = [];
  const placed = new Set<PersonId>();
  for (const p of people) {
    if (placed.has(p.id)) continue;
    if (p.partnerId !== undefined) {
      const submitterIds = [p.id, p.partnerId];
      dishes.push({ id: `D-${submitterIds.join('-')}`, submitterIds });
      placed.add(p.id);
      placed.add(p.partnerId);
    } else {
      dishes.push({ id: `D-${p.id}`, submitterIds: [p.id] });
      placed.add(p.id);
    }
  }
  return dishes;
}
