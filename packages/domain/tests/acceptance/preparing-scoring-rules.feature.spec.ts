import { fileURLToPath } from 'node:url';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import {
  compile,
  type AntiBias,
  type Attribution,
  type CompileErrorCode,
  type CompileResult,
  type ContestDraft,
  type Person,
  type ScoreRange,
} from '../../src/index.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./preparing-scoring-rules.feature', import.meta.url)),
);

type Row = Record<string, string>;

interface World {
  attribution: Attribution;
  antiBias: AntiBias;
  range: ScoreRange;
  uniquePerCategory: boolean;
  noScorePairs: Array<[string, string]>;
  participants: Person[];
  result?: CompileResult;
}

function freshWorld(): World {
  return {
    attribution: 'per_person',
    antiBias: 'none',
    range: { type: 'auto' },
    uniquePerCategory: false,
    noScorePairs: [],
    participants: [],
  };
}

function parseParticipants(rows: readonly Row[], w: World): Person[] {
  const noScore = new Map<string, string[]>();
  for (const [one, other] of w.noScorePairs) {
    const list = noScore.get(one) ?? [];
    list.push(other);
    noScore.set(one, list);
  }
  return rows.map((r) => {
    const name = r.name ?? '';
    const partner = r.partner?.trim();
    const ns = noScore.get(name);
    return {
      id: name,
      displayName: name,
      ...(partner ? { partnerId: partner } : {}),
      ...(ns ? { noScoreWith: ns } : {}),
    };
  });
}

function buildDraft(w: World): ContestDraft {
  return {
    attribution: w.attribution,
    antiBias: w.antiBias,
    scoring: {
      categories: [{ id: 'c1', name: 'Taste' }],
      range: w.range,
      uniquePerCategory: w.uniquePerCategory,
    },
    participants: w.participants,
  };
}

function contestOf(w: World) {
  const r = w.result;
  if (!r) throw new Error('the contest was not prepared');
  expect(r.ok).toBe(true);
  if (!r.ok) throw new Error(`expected success, got ${r.error.code}`);
  return r.contest;
}

function assertDishCount(w: World, n: number): void {
  expect(contestOf(w).dishes.length).toBe(n);
}

function assertShareDish(w: World, a: string, b: string): void {
  const shared = contestOf(w).dishes.some(
    (d) => d.submitterIds.includes(a) && d.submitterIds.includes(b),
  );
  expect(shared).toBe(true);
}

function assertMayScoreAllExcept(w: World, voter: string, excludedOwners: string[]): void {
  const c = contestOf(w);
  const excluded = new Set(
    c.dishes.filter((d) => d.submitterIds.some((s) => excludedOwners.includes(s))).map((d) => d.id),
  );
  const expected = c.dishes
    .filter((d) => !excluded.has(d.id))
    .map((d) => d.id)
    .sort();
  const actual = c.dishes
    .filter((d) => (c.allowedVoters.get(d.id) ?? new Set()).has(voter))
    .map((d) => d.id)
    .sort();
  expect(actual).toEqual(expected);
}

function assertRange(w: World, voter: string, min: number, max: number): void {
  expect(contestOf(w).scoreRangeByVoter.get(voter)).toEqual({ min, max });
}

function assertRejected(w: World, code: CompileErrorCode): void {
  const r = w.result;
  if (!r) throw new Error('the contest was not prepared');
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.code).toBe(code);
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('Strict variant — per person, couples barred, ranked scores', ({ Given, And, When, Then }) => {
    const w = freshWorld();
    Given('a contest scored per person', () => void (w.attribution = 'per_person'));
    And('couples may not score each other', () => void (w.antiBias = 'couples'));
    And('scores in a category must all be different', () => void (w.uniquePerCategory = true));
    And('the score range adjusts to how many dishes a judge can score', () => void (w.range = { type: 'auto' }));
    And('the participants are:', (_ctx, table: Row[]) => void (w.participants = parseParticipants(table, w)));
    When('the contest is prepared for scoring', () => void (w.result = compile(buildDraft(w))));
    Then('there are 10 dishes, one per person', () => assertDishCount(w, 10));
    And("A may score every dish except A's own and B's", () => assertMayScoreAllExcept(w, 'A', ['A', 'B']));
    And('A may give each category a score from 1 to 8', () => assertRange(w, 'A', 1, 8));
    And("I may score every dish except I's own", () => assertMayScoreAllExcept(w, 'I', ['I']));
    And('I may give each category a score from 1 to 9', () => assertRange(w, 'I', 1, 9));
  });

  Scenario('Joint variant — per couple, fixed range, repeats allowed', ({ Given, And, When, Then }) => {
    const w = freshWorld();
    Given('a contest scored per couple', () => void (w.attribution = 'per_couple'));
    And('couples may not score each other', () => void (w.antiBias = 'couples'));
    And('scores in a category may repeat', () => void (w.uniquePerCategory = false));
    And('the score range is fixed from 1 to 10', () => void (w.range = { type: 'fixed', min: 1, max: 10 }));
    And('the participants are:', (_ctx, table: Row[]) => void (w.participants = parseParticipants(table, w)));
    When('the contest is prepared for scoring', () => void (w.result = compile(buildDraft(w))));
    Then('there are 6 dishes, one per couple and one per single', () => assertDishCount(w, 6));
    And('A and B share one dish', () => assertShareDish(w, 'A', 'B'));
    And("A may score every dish except A and B's shared dish", () => assertMayScoreAllExcept(w, 'A', ['A', 'B']));
    And('A may give each category a score from 1 to 10', () => assertRange(w, 'A', 1, 10));
  });

  Scenario('Permissive variant — per person, fixed range, repeats allowed', ({ Given, And, When, Then }) => {
    const w = freshWorld();
    Given('a contest scored per person', () => void (w.attribution = 'per_person'));
    And('couples may not score each other', () => void (w.antiBias = 'couples'));
    And('scores in a category may repeat', () => void (w.uniquePerCategory = false));
    And('the score range is fixed from 1 to 10', () => void (w.range = { type: 'fixed', min: 1, max: 10 }));
    And('the participants are:', (_ctx, table: Row[]) => void (w.participants = parseParticipants(table, w)));
    When('the contest is prepared for scoring', () => void (w.result = compile(buildDraft(w))));
    Then('there are 3 dishes, one per person', () => assertDishCount(w, 3));
    And("A may score every dish except A's own and B's", () => assertMayScoreAllExcept(w, 'A', ['A', 'B']));
    And('A may give each category a score from 1 to 10', () => assertRange(w, 'A', 1, 10));
  });

  Scenario('No anti-bias — everyone scores every dish but their own', ({ Given, And, When, Then }) => {
    const w = freshWorld();
    Given('a contest scored per person', () => void (w.attribution = 'per_person'));
    And('there is no anti-bias rule', () => void (w.antiBias = 'none'));
    And('the participants are:', (_ctx, table: Row[]) => void (w.participants = parseParticipants(table, w)));
    When('the contest is prepared for scoring', () => void (w.result = compile(buildDraft(w))));
    Then("A may score every dish except A's own", () => assertMayScoreAllExcept(w, 'A', ['A']));
  });

  Scenario('Arbitrary no-score pairs', ({ Given, And, When, Then }) => {
    const w = freshWorld();
    Given('a contest scored per person', () => void (w.attribution = 'per_person'));
    And('these people may not score each other:', (_ctx, table: Row[]) => {
      w.antiBias = 'arbitrary_pairs';
      w.noScorePairs = table.map((r) => [r.one ?? '', r.other ?? '']);
    });
    And('the participants are:', (_ctx, table: Row[]) => void (w.participants = parseParticipants(table, w)));
    When('the contest is prepared for scoring', () => void (w.result = compile(buildDraft(w))));
    Then("A may score every dish except A's own and C's", () => assertMayScoreAllExcept(w, 'A', ['A', 'C']));
    And("B may score every dish except B's own", () => assertMayScoreAllExcept(w, 'B', ['B']));
  });

  Scenario('A partner reference with no matching person is rejected', ({ Given, And, When, Then }) => {
    const w = freshWorld();
    Given('a contest scored per person', () => void (w.attribution = 'per_person'));
    And('the participants are:', (_ctx, table: Row[]) => void (w.participants = parseParticipants(table, w)));
    When('the contest is prepared for scoring', () => void (w.result = compile(buildDraft(w))));
    Then('preparing the contest is rejected because a partner is missing', () => assertRejected(w, 'MISSING_PARTNER'));
  });

  Scenario('A judge who can score no dishes is rejected', ({ Given, And, When, Then }) => {
    const w = freshWorld();
    Given('a contest scored per person', () => void (w.attribution = 'per_person'));
    And('couples may not score each other', () => void (w.antiBias = 'couples'));
    And('the participants are:', (_ctx, table: Row[]) => void (w.participants = parseParticipants(table, w)));
    When('the contest is prepared for scoring', () => void (w.result = compile(buildDraft(w))));
    Then('preparing the contest is rejected because a judge could score nothing', () =>
      assertRejected(w, 'JUDGE_CANNOT_SCORE_ANY_DISH'));
  });
});
