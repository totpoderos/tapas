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
  it('4 people, 2 couples, on their own with partners kept apart, ranked', () => {
    const contest = ok({
      format: 'solo_with_partners',
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

  it('3 people, everyone on their own', () => {
    const contest = ok({
      format: 'solo',
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

  it('3 people with a couple among them, everyone on their own — the partners keep nobody apart', () => {
    const contest = ok({
      format: 'solo',
      scoring: { categories: cats, range: { type: 'auto' }, uniquePerCategory: false },
      participants: [person('A', 'B'), person('B', 'A'), person('I')],
    });

    expect(serialize(contest)).toEqual({
      dishes: [
        { id: 'D-A', submitters: ['A'] },
        { id: 'D-B', submitters: ['B'] },
        { id: 'D-I', submitters: ['I'] },
      ],
      // A scores B's dish and B scores A's: under this format a partner is a
      // roster fact, not an exclusion.
      allowedVoters: { 'D-A': ['B', 'I'], 'D-B': ['A', 'I'], 'D-I': ['A', 'B'] },
      ranges: { A: { min: 1, max: 2 }, B: { min: 1, max: 2 }, I: { min: 1, max: 2 } },
      uniquePerCategory: false,
    });
  });

  it('6 people in 3 couples cooking together, fixed range', () => {
    const contest = ok({
      format: 'couples',
      scoring: { categories: cats, range: { type: 'fixed', min: 1, max: 10 }, uniquePerCategory: false },
      participants: [
        person('A', 'B'),
        person('B', 'A'),
        person('C', 'D'),
        person('D', 'C'),
        person('E', 'F'),
        person('F', 'E'),
      ],
    });

    expect(serialize(contest)).toEqual({
      dishes: [
        { id: 'D-A-B', submitters: ['A', 'B'] },
        { id: 'D-C-D', submitters: ['C', 'D'] },
        { id: 'D-E-F', submitters: ['E', 'F'] },
      ],
      allowedVoters: {
        'D-A-B': ['C', 'D', 'E', 'F'],
        'D-C-D': ['A', 'B', 'E', 'F'],
        'D-E-F': ['A', 'B', 'C', 'D'],
      },
      ranges: {
        A: { min: 1, max: 10 },
        B: { min: 1, max: 10 },
        C: { min: 1, max: 10 },
        D: { min: 1, max: 10 },
        E: { min: 1, max: 10 },
        F: { min: 1, max: 10 },
      },
      uniquePerCategory: false,
    });
  });
});
