import { describe, expect, it } from 'vitest';
import { compile, type ContestDraft, type MaterializedContest, type Person } from '../../src/index.js';

// A frozen corpus: hand-curated drafts with their fully-specified expected
// output. If the compiler's behaviour ever drifts, these fail loudly.

function person(id: string, partnerId?: string): Person {
  return { id, displayName: id, ...(partnerId ? { partnerId } : {}) };
}

/** Serialize to a stable, comparable shape (Sets/Maps → sorted arrays/records). */
function serialize(c: MaterializedContest) {
  return {
    dishes: c.dishes.map((d) => ({ id: d.id, submitters: [...d.submitterIds].sort() })),
    allowedVoters: Object.fromEntries(
      c.dishes.map((d) => [d.id, [...(c.allowedVoters.get(d.id) ?? [])].sort()]),
    ),
    ranges: Object.fromEntries([...c.scoreRangeByVoter.entries()].sort(([a], [b]) => a.localeCompare(b))),
    uniquePerCategory: c.uniquePerCategory,
  };
}

function ok(draft: ContestDraft): MaterializedContest {
  const r = compile(draft);
  if (!r.ok) throw new Error(`expected ok, got ${r.error.code}`);
  return r.contest;
}

const cats = [{ id: 'c1', name: 'Taste' }];

describe('compile — golden corpus', () => {
  it('4 people, 2 couples, per person, couples barred, ranked', () => {
    const contest = ok({
      attribution: 'per_person',
      antiBias: 'couples',
      scoring: { categories: cats, range: { type: 'auto' }, uniquePerCategory: true },
      participants: [person('A', 'B'), person('B', 'A'), person('C', 'D'), person('D', 'C')],
    });

    expect(serialize(contest)).toEqual({
      dishes: [
        { id: 'D-A', submitters: ['A'] },
        { id: 'D-B', submitters: ['B'] },
        { id: 'D-C', submitters: ['C'] },
        { id: 'D-D', submitters: ['D'] },
      ],
      allowedVoters: {
        'D-A': ['C', 'D'],
        'D-B': ['C', 'D'],
        'D-C': ['A', 'B'],
        'D-D': ['A', 'B'],
      },
      ranges: { A: { min: 1, max: 2 }, B: { min: 1, max: 2 }, C: { min: 1, max: 2 }, D: { min: 1, max: 2 } },
      uniquePerCategory: true,
    });
  });

  it('3 people, per person, no anti-bias', () => {
    const contest = ok({
      attribution: 'per_person',
      antiBias: 'none',
      scoring: { categories: cats, range: { type: 'auto' }, uniquePerCategory: false },
      participants: [person('A'), person('B'), person('C')],
    });

    expect(serialize(contest)).toEqual({
      dishes: [
        { id: 'D-A', submitters: ['A'] },
        { id: 'D-B', submitters: ['B'] },
        { id: 'D-C', submitters: ['C'] },
      ],
      allowedVoters: { 'D-A': ['B', 'C'], 'D-B': ['A', 'C'], 'D-C': ['A', 'B'] },
      ranges: { A: { min: 1, max: 2 }, B: { min: 1, max: 2 }, C: { min: 1, max: 2 } },
      uniquePerCategory: false,
    });
  });

  it('per couple with a single, couples barred, fixed range', () => {
    const contest = ok({
      attribution: 'per_couple',
      antiBias: 'couples',
      scoring: { categories: cats, range: { type: 'fixed', min: 1, max: 10 }, uniquePerCategory: false },
      participants: [person('A', 'B'), person('B', 'A'), person('I')],
    });

    expect(serialize(contest)).toEqual({
      dishes: [
        { id: 'D-A-B', submitters: ['A', 'B'] },
        { id: 'D-I', submitters: ['I'] },
      ],
      allowedVoters: { 'D-A-B': ['I'], 'D-I': ['A', 'B'] },
      ranges: { A: { min: 1, max: 10 }, B: { min: 1, max: 10 }, I: { min: 1, max: 10 } },
      uniquePerCategory: false,
    });
  });
});
