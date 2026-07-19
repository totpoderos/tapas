import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  compile,
  type AntiBias,
  type Attribution,
  type ContestDraft,
  type Person,
  type ScoreRange,
} from '../../src/index.js';

interface Config {
  n: number;
  coupled: boolean;
  attribution: Attribution;
  antiBias: AntiBias;
  range: ScoreRange;
  unique: boolean;
}

const configArb: fc.Arbitrary<Config> = fc.record({
  n: fc.integer({ min: 1, max: 8 }),
  coupled: fc.boolean(),
  attribution: fc.constantFrom<Attribution>('per_person', 'per_couple'),
  antiBias: fc.constantFrom<AntiBias>('none', 'couples', 'arbitrary_pairs'),
  range: fc.constantFrom<ScoreRange>({ type: 'auto' }, { type: 'fixed', min: 1, max: 10 }),
  unique: fc.boolean(),
});

function buildDraft(cfg: Config): ContestDraft {
  const people: Person[] = [];
  for (let i = 0; i < cfg.n; i++) people.push({ id: `p${i}`, displayName: `p${i}` });

  if (cfg.coupled) {
    for (let i = 0; i + 1 < cfg.n; i += 2) {
      const a = people[i];
      const b = people[i + 1];
      if (!a || !b) continue;
      people[i] = { ...a, partnerId: b.id };
      people[i + 1] = { ...b, partnerId: a.id };
    }
  }

  if (cfg.antiBias === 'arbitrary_pairs' && cfg.n >= 3) {
    const first = people[0];
    if (first) people[0] = { ...first, noScoreWith: ['p2'] };
  }

  return {
    attribution: cfg.attribution,
    antiBias: cfg.antiBias,
    scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: cfg.range, uniquePerCategory: cfg.unique },
    participants: people,
  };
}

describe('compile — properties', () => {
  it('is deterministic for any draft', () => {
    fc.assert(
      fc.property(configArb, (cfg) => {
        const draft = buildDraft(cfg);
        expect(compile(draft)).toEqual(compile(draft));
      }),
      { numRuns: 300 },
    );
  });

  it('when it succeeds, no judge scores their own dish and ranges are valid', () => {
    fc.assert(
      fc.property(configArb, (cfg) => {
        const draft = buildDraft(cfg);
        const r = compile(draft);
        if (!r.ok) return;
        const c = r.contest;

        for (const dish of c.dishes) {
          const allowed = c.allowedVoters.get(dish.id) ?? new Set<string>();
          for (const owner of dish.submitterIds) expect(allowed.has(owner)).toBe(false);
        }

        for (const bounds of c.scoreRangeByVoter.values()) {
          expect(bounds.min).toBeGreaterThanOrEqual(1);
          expect(bounds.max).toBeGreaterThanOrEqual(bounds.min);
        }

        const scoreable = new Map<string, number>();
        for (const dish of c.dishes) {
          for (const v of c.allowedVoters.get(dish.id) ?? []) scoreable.set(v, (scoreable.get(v) ?? 0) + 1);
        }
        for (const p of draft.participants) expect(scoreable.get(p.id) ?? 0).toBeGreaterThanOrEqual(1);
      }),
      { numRuns: 300 },
    );
  });

  it('under couples anti-bias, a judge is never allowed on their partner’s dish', () => {
    fc.assert(
      fc.property(configArb, (cfg) => {
        const draft = buildDraft({ ...cfg, antiBias: 'couples' });
        const r = compile(draft);
        if (!r.ok) return;
        const c = r.contest;
        for (const p of draft.participants) {
          if (!p.partnerId) continue;
          for (const dish of c.dishes) {
            if (p.partnerId !== undefined && dish.submitterIds.includes(p.partnerId)) {
              expect((c.allowedVoters.get(dish.id) ?? new Set()).has(p.id)).toBe(false);
            }
          }
        }
      }),
      { numRuns: 300 },
    );
  });
});
