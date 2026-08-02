import { describe, expect, it } from 'vitest';
import {
  compile,
  type CompileResult,
  type ContestDraft,
  type MaterializedContest,
  type Person,
} from '../../src/index.js';

// --- helpers ---

function person(id: string, partnerId?: string): Person {
  return { id, displayName: id, ...(partnerId ? { partnerId } : {}) };
}

function makeDraft(over: Partial<ContestDraft> & { participants: Person[] }): ContestDraft {
  return {
    format: 'solo',
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

// --- who cooks ---

describe('compile — who cooks', () => {
  it('solo makes one dish per person', () => {
    const c = ok(compile(makeDraft({ participants: [person('A'), person('B'), person('C')] })));
    expect(c.dishes).toHaveLength(3);
    expect(c.dishes.every((d) => d.submitterIds.length === 1)).toBe(true);
  });

  it('solo_with_partners still makes one dish per person', () => {
    const c = ok(compile(makeDraft({ format: 'solo_with_partners', participants: couples4 })));
    expect(c.dishes).toHaveLength(4);
    expect(c.dishes.every((d) => d.submitterIds.length === 1)).toBe(true);
  });

  it('a partner under solo changes nothing about who cooks', () => {
    const c = ok(compile(makeDraft({ participants: couples4 })));
    expect(c.dishes).toHaveLength(4);
    expect(c.dishes.every((d) => d.submitterIds.length === 1)).toBe(true);
  });

  it('couples makes one dish per couple', () => {
    const c = ok(compile(makeDraft({ format: 'couples', participants: couples4 })));
    expect(c.dishes).toHaveLength(2);
    expect(c.dishes.every((d) => d.submitterIds.length === 2)).toBe(true);
  });

  it('dish ids are unique', () => {
    const c = ok(compile(makeDraft({ participants: [person('A'), person('B'), person('C')] })));
    expect(new Set(c.dishes.map((d) => d.id)).size).toBe(c.dishes.length);
  });
});

// --- who may score ---

describe('compile — solo', () => {
  it('lets everyone score every dish but their own', () => {
    const c = ok(compile(makeDraft({ participants: [person('A'), person('B'), person('C')] })));
    expect(voters(c, 'D-A')).toEqual(['B', 'C']);
    expect(voters(c, 'D-B')).toEqual(['A', 'C']);
    expect(voters(c, 'D-C')).toEqual(['A', 'B']);
  });

  it('keeps nobody apart even when partners are recorded', () => {
    const c = ok(compile(makeDraft({ participants: couples4 })));
    expect(voters(c, 'D-A')).toEqual(['B', 'C', 'D']);
    expect(voters(c, 'D-B')).toEqual(['A', 'C', 'D']);
  });
});

describe('compile — solo_with_partners', () => {
  it('bars a judge from their partner’s dish', () => {
    const c = ok(compile(makeDraft({ format: 'solo_with_partners', participants: couples4 })));
    expect(voters(c, 'D-A')).toEqual(['C', 'D']); // not A (own) nor B (partner)
    expect(voters(c, 'D-B')).toEqual(['C', 'D']);
  });

  it('is symmetric: if A can’t score B’s dish, B can’t score A’s', () => {
    const c = ok(compile(makeDraft({ format: 'solo_with_partners', participants: couples4 })));
    expect(voters(c, 'D-A').includes('B')).toBe(false);
    expect(voters(c, 'D-B').includes('A')).toBe(false);
  });

  it('leaves somebody without a partner scoring everyone else', () => {
    const c = ok(
      compile(makeDraft({ format: 'solo_with_partners', participants: [...couples4, person('I')] })),
    );
    expect(voters(c, 'D-I')).toEqual(['A', 'B', 'C', 'D']);
    expect(voters(c, 'D-A')).toEqual(['C', 'D', 'I']);
  });
});

describe('compile — couples', () => {
  it('keeps a couple off their own shared dish without a rule of its own', () => {
    const c = ok(compile(makeDraft({ format: 'couples', participants: couples4 })));
    expect(voters(c, 'D-A-B')).toEqual(['C', 'D']);
    expect(voters(c, 'D-C-D')).toEqual(['A', 'B']);
  });

  it('gives both partners exactly the same dishes to score', () => {
    const c = ok(
      compile(makeDraft({ format: 'couples', participants: [...couples4, person('E', 'F'), person('F', 'E')] })),
    );
    const openTo = (voter: string) =>
      c.dishes.filter((d) => voters(c, d.id).includes(voter)).map((d) => d.id).sort();
    expect(openTo('A')).toEqual(openTo('B'));
    expect(openTo('A')).toHaveLength(2);
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

  /*
   * A contest judged on nothing is broken in a way that only shows at the end:
   * its participants get a ballot with nothing to score, every dish totals zero,
   * and the reveal names all of them joint winners. Caught here rather than when
   * the draft is written — a draft with no categories yet is an ordinary
   * halfway state.
   */
  it('rejects a contest that is judged on nothing', () => {
    const result = compile(
      makeDraft({
        participants: [person('A'), person('B')],
        scoring: { categories: [], range: { type: 'auto' }, uniquePerCategory: false },
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NO_CATEGORIES');
    expect(result.error.message).toMatch(/judged on/i);
  });

  it('rejects an inverted fixed range', () => {
    const r = compile(
      makeDraft({
        scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'fixed', min: 10, max: 1 }, uniquePerCategory: false },
        participants: [person('A'), person('B')],
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_RANGE');
  });

  it('rejects a fixed range that does not start at 1 or above', () => {
    const r = compile(
      makeDraft({
        scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'fixed', min: 0, max: 5 }, uniquePerCategory: false },
        participants: [person('A'), person('B')],
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_RANGE');
  });
});

describe('compile — auto range', () => {
  it('resolves to 1..(dishes the judge can score)', () => {
    const c = ok(
      compile(makeDraft({ format: 'solo_with_partners', participants: [...couples4, person('I'), person('J')] })),
    );
    // partnered judges are barred from their partner’s dish → score 4 of 6
    expect(c.scoreRangeByVoter.get('A')).toEqual({ min: 1, max: 4 });
    // those without a partner are barred from none → score 5 of 6
    expect(c.scoreRangeByVoter.get('I')).toEqual({ min: 1, max: 5 });
  });

  it('counts dishes, not people, under couples', () => {
    const c = ok(
      compile(makeDraft({ format: 'couples', participants: [...couples4, person('E', 'F'), person('F', 'E')] })),
    );
    // 3 dishes, of which a judge's own couple's is not one → 2
    expect(c.scoreRangeByVoter.get('A')).toEqual({ min: 1, max: 2 });
  });

  it('works with repeats allowed (auto range, not unique)', () => {
    const c = ok(compile(makeDraft({ participants: [person('A'), person('B'), person('C')], scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'auto' }, uniquePerCategory: false } })));
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

  it('rejects a couples contest where somebody has no partner', () => {
    const r = compile(makeDraft({ format: 'couples', participants: [...couples4, person('E')] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('UNPARTNERED_IN_COUPLES');
  });

  it('accepts somebody without a partner under the other two formats', () => {
    for (const format of ['solo', 'solo_with_partners'] as const) {
      const r = compile(makeDraft({ format, participants: [...couples4, person('E')] }));
      expect(r.ok).toBe(true);
    }
  });

  it('rejects a contest where a judge could score nothing', () => {
    const r = compile(
      makeDraft({ format: 'solo_with_partners', participants: [person('A', 'B'), person('B', 'A')] }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('JUDGE_CANNOT_SCORE_ANY_DISH');
  });

  it('rejects a single couple cooking together, who would have only their own dish', () => {
    const r = compile(makeDraft({ format: 'couples', participants: [person('A', 'B'), person('B', 'A')] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('JUDGE_CANNOT_SCORE_ANY_DISH');
  });
});

// --- output & determinism ---

describe('compile — materialized output', () => {
  it('carries uniquePerCategory through (true)', () => {
    const c = ok(compile(makeDraft({ participants: [person('A'), person('B')], scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'auto' }, uniquePerCategory: true } })));
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
    const draft = makeDraft({ format: 'solo_with_partners', participants: [...couples4, person('I'), person('J')] });
    expect(compile(draft)).toEqual(compile(draft));
  });
});
