import { describe, expect, it } from 'vitest';
import {
  compile,
  type CompileResult,
  type ContestDraft,
  type MaterializedContest,
  type Person,
} from '../../src/index.js';

// --- helpers ---

function person(id: string, partnerId?: string, noScoreWith?: string[]): Person {
  return {
    id,
    displayName: id,
    ...(partnerId ? { partnerId } : {}),
    ...(noScoreWith ? { noScoreWith } : {}),
  };
}

function makeDraft(over: Partial<ContestDraft> & { participants: Person[] }): ContestDraft {
  return {
    attribution: 'per_person',
    antiBias: 'none',
    scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'auto' }, uniquePerCategory: false },
    ...over,
  };
}

function ok(result: CompileResult): MaterializedContest {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`expected ok, got ${result.error.code}`);
  return result.contest;
}

function voters(c: MaterializedContest, dishId: string): string[] {
  return [...(c.allowedVoters.get(dishId) ?? new Set<string>())].sort();
}

const couples4 = [person('A', 'B'), person('B', 'A'), person('C', 'D'), person('D', 'C')];

// --- attribution ---

describe('compile — attribution', () => {
  it('per_person makes one dish per person', () => {
    const c = ok(compile(makeDraft({ participants: [person('A'), person('B'), person('C')] })));
    expect(c.dishes).toHaveLength(3);
    expect(c.dishes.every((d) => d.submitterIds.length === 1)).toBe(true);
  });

  it('per_couple makes one dish per couple and one per single', () => {
    const c = ok(
      compile(
        makeDraft({
          attribution: 'per_couple',
          participants: [...couples4, person('I'), person('J')],
        }),
      ),
    );
    expect(c.dishes).toHaveLength(4); // 2 couples + 2 singles
    const couple = c.dishes.find((d) => d.submitterIds.length === 2);
    expect(couple?.submitterIds).toHaveLength(2);
  });

  it('per_couple with only couples makes half as many dishes', () => {
    const c = ok(compile(makeDraft({ attribution: 'per_couple', participants: couples4 })));
    expect(c.dishes).toHaveLength(2);
  });

  it('dish ids are unique', () => {
    const c = ok(compile(makeDraft({ participants: [person('A'), person('B'), person('C')] })));
    expect(new Set(c.dishes.map((d) => d.id)).size).toBe(c.dishes.length);
  });
});

// --- anti-bias ---

describe('compile — anti-bias none', () => {
  it('lets everyone score every dish but their own', () => {
    const c = ok(compile(makeDraft({ participants: [person('A'), person('B'), person('C')] })));
    expect(voters(c, 'D-A')).toEqual(['B', 'C']);
    expect(voters(c, 'D-B')).toEqual(['A', 'C']);
    expect(voters(c, 'D-C')).toEqual(['A', 'B']);
  });
});

describe('compile — anti-bias couples', () => {
  it('bars a judge from their partner’s dish', () => {
    const c = ok(compile(makeDraft({ antiBias: 'couples', participants: couples4 })));
    expect(voters(c, 'D-A')).toEqual(['C', 'D']); // not A (own) nor B (partner)
    expect(voters(c, 'D-B')).toEqual(['C', 'D']);
  });

  it('is symmetric: if A can’t score B’s dish, B can’t score A’s', () => {
    const c = ok(compile(makeDraft({ antiBias: 'couples', participants: couples4 })));
    expect(voters(c, 'D-A').includes('B')).toBe(false);
    expect(voters(c, 'D-B').includes('A')).toBe(false);
  });
});

describe('compile — anti-bias arbitrary_pairs', () => {
  it('bars a listed pair mutually, even if declared one-directionally', () => {
    const c = ok(
      compile(
        makeDraft({
          antiBias: 'arbitrary_pairs',
          participants: [person('A', undefined, ['C']), person('B'), person('C')],
        }),
      ),
    );
    expect(voters(c, 'D-A')).toEqual(['B']); // not A (own), not C (barred)
    expect(voters(c, 'D-C')).toEqual(['B']); // symmetric: not A
    expect(voters(c, 'D-B')).toEqual(['A', 'C']); // B unaffected
  });

  it('ignores noScoreWith when the mode is not arbitrary_pairs', () => {
    const c = ok(
      compile(makeDraft({ antiBias: 'none', participants: [person('A', undefined, ['C']), person('B'), person('C')] })),
    );
    expect(voters(c, 'D-A')).toEqual(['B', 'C']);
  });
});

// --- range ---

describe('compile — fixed range', () => {
  it('gives every judge the fixed bounds', () => {
    const c = ok(
      compile(
        makeDraft({
          scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'fixed', min: 1, max: 10 }, uniquePerCategory: false },
          participants: [person('A'), person('B'), person('C')],
        }),
      ),
    );
    expect(c.scoreRangeByVoter.get('A')).toEqual({ min: 1, max: 10 });
    expect(c.scoreRangeByVoter.get('B')).toEqual({ min: 1, max: 10 });
  });

  it('rejects an inverted fixed range', () => {
    const r = compile(
      makeDraft({
        scoring: { categories: [], range: { type: 'fixed', min: 10, max: 1 }, uniquePerCategory: false },
        participants: [person('A'), person('B')],
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_RANGE');
  });

  it('rejects a fixed range that does not start at 1 or above', () => {
    const r = compile(
      makeDraft({
        scoring: { categories: [], range: { type: 'fixed', min: 0, max: 5 }, uniquePerCategory: false },
        participants: [person('A'), person('B')],
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_RANGE');
  });
});

describe('compile — auto range', () => {
  it('resolves to 1..(dishes the judge can score)', () => {
    const c = ok(compile(makeDraft({ antiBias: 'couples', participants: [...couples4, person('I'), person('J')] })));
    // coupled judges are barred from their partner’s dish → score 4 of 6
    expect(c.scoreRangeByVoter.get('A')).toEqual({ min: 1, max: 4 });
    // singles are barred from none → score 5 of 6
    expect(c.scoreRangeByVoter.get('I')).toEqual({ min: 1, max: 5 });
  });

  it('works with repeats allowed (auto range, not unique)', () => {
    const c = ok(compile(makeDraft({ participants: [person('A'), person('B'), person('C')], scoring: { categories: [], range: { type: 'auto' }, uniquePerCategory: false } })));
    expect(c.scoreRangeByVoter.get('A')).toEqual({ min: 1, max: 2 });
    expect(c.uniquePerCategory).toBe(false);
  });
});

// --- validation ---

describe('compile — validation', () => {
  it('rejects an empty contest', () => {
    const r = compile(makeDraft({ participants: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NO_PARTICIPANTS');
  });

  it('rejects duplicate participant ids', () => {
    const r = compile(makeDraft({ participants: [person('A'), person('A')] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('DUPLICATE_PERSON_ID');
  });

  it('rejects a partner reference to a non-participant', () => {
    const r = compile(makeDraft({ participants: [person('A', 'Z')] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('MISSING_PARTNER');
  });

  it('rejects a non-reciprocal partnership', () => {
    const r = compile(makeDraft({ participants: [person('A', 'B'), person('B', 'C'), person('C', 'B')] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INCONSISTENT_PARTNER');
  });

  it('rejects a contest where a judge could score nothing', () => {
    const r = compile(makeDraft({ antiBias: 'couples', participants: [person('A', 'B'), person('B', 'A')] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('JUDGE_CANNOT_SCORE_ANY_DISH');
  });
});

// --- output & determinism ---

describe('compile — materialized output', () => {
  it('carries uniquePerCategory through (true)', () => {
    const c = ok(compile(makeDraft({ participants: [person('A'), person('B')], scoring: { categories: [], range: { type: 'auto' }, uniquePerCategory: true } })));
    expect(c.uniquePerCategory).toBe(true);
  });

  it('carries the categories through', () => {
    const cats = [{ id: 'p', name: 'Presentation' }, { id: 't', name: 'Taste' }];
    const c = ok(compile(makeDraft({ participants: [person('A'), person('B')], scoring: { categories: cats, range: { type: 'auto' }, uniquePerCategory: false } })));
    expect(c.categories).toEqual(cats);
  });

  it('never lets a judge score their own dish', () => {
    const c = ok(compile(makeDraft({ participants: [person('A'), person('B'), person('C')] })));
    for (const dish of c.dishes) {
      for (const owner of dish.submitterIds) {
        expect((c.allowedVoters.get(dish.id) ?? new Set()).has(owner)).toBe(false);
      }
    }
  });

  it('is deterministic — same draft compiles to an identical result', () => {
    const draft = makeDraft({ antiBias: 'couples', participants: [...couples4, person('I'), person('J')] });
    expect(compile(draft)).toEqual(compile(draft));
  });
});
