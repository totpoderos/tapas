import { fileURLToPath } from 'node:url';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import {
  compile,
  type CompileErrorCode,
  type CompileResult,
  type ContestDraft,
  type ContestFormat,
  type Person,
  type ScoreRange,
} from '../../src/index.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./preparing-scoring-rules.feature', import.meta.url)),
);

type Row = Record<string, string>;

interface World {
  format: ContestFormat;
  range: ScoreRange;
  uniquePerCategory: boolean;
  participants: Person[];
  result?: CompileResult;
}

function freshWorld(): World {
  return {
    format: 'solo',
    range: { type: 'auto' },
    uniquePerCategory: false,
    participants: [],
  };
}

function parseParticipants(rows: readonly Row[]): Person[] {
  return rows.map((r) => {
    const name = r.name ?? '';
    const partner = r.partner?.trim();
    return { id: name, displayName: name, ...(partner ? { partnerId: partner } : {}) };
  });
}

function buildDraft(w: World): ContestDraft {
  return {
    format: w.format,
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

function dishesOpenTo(w: World, voter: string): string[] {
  const c = contestOf(w);
  return c.dishes
    .filter((d) => (c.allowedVoters.get(d.id) ?? new Set()).has(voter))
    .map((d) => d.id)
    .sort();
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
  expect(dishesOpenTo(w, voter)).toEqual(expected);
}

/**
 * Under the couples format the shared dish is the only thing kept from either
 * partner, so the two of them see exactly the same ballot. Asserted directly
 * rather than inferred from two separate exclusions, because it is the property
 * that makes a second anti-bias rule unnecessary.
 */
function assertSameDishes(w: World, a: string, b: string): void {
  expect(dishesOpenTo(w, a)).toEqual(dishesOpenTo(w, b));
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
  Scenario('Everyone on their own scores every dish but their own', ({ Given, And, When, Then }) => {
    const w = freshWorld();
    Given('a contest where everyone is on their own', () => void (w.format = 'solo'));
    And('scores in a category may repeat', () => void (w.uniquePerCategory = false));
    And('the score range is fixed from 1 to 10', () => void (w.range = { type: 'fixed', min: 1, max: 10 }));
    And('the participants are:', (_ctx, table: Row[]) => void (w.participants = parseParticipants(table)));
    When('the contest is prepared for scoring', () => void (w.result = compile(buildDraft(w))));
    Then('there are 3 dishes, one per person', () => assertDishCount(w, 3));
    And("A may score every dish except A's own", () => assertMayScoreAllExcept(w, 'A', ['A']));
    And('A may give each category a score from 1 to 10', () => assertRange(w, 'A', 1, 10));
  });

  Scenario('Partners recorded under this format keep nobody apart', ({ Given, And, When, Then }) => {
    const w = freshWorld();
    Given('a contest where everyone is on their own', () => void (w.format = 'solo'));
    And('the participants are:', (_ctx, table: Row[]) => void (w.participants = parseParticipants(table)));
    When('the contest is prepared for scoring', () => void (w.result = compile(buildDraft(w))));
    Then('there are 3 dishes, one per person', () => assertDishCount(w, 3));
    And("A may score every dish except A's own", () => assertMayScoreAllExcept(w, 'A', ['A']));
    And("B may score every dish except B's own", () => assertMayScoreAllExcept(w, 'B', ['B']));
  });

  Scenario("A partner's dish is not theirs to score, and the range follows", ({ Given, And, When, Then }) => {
    const w = freshWorld();
    Given('a contest where everyone is on their own with partners kept apart', () => void (w.format = 'solo_with_partners'));
    And('scores in a category must all be different', () => void (w.uniquePerCategory = true));
    And('the score range adjusts to how many dishes a judge can score', () => void (w.range = { type: 'auto' }));
    And('the participants are:', (_ctx, table: Row[]) => void (w.participants = parseParticipants(table)));
    When('the contest is prepared for scoring', () => void (w.result = compile(buildDraft(w))));
    Then('there are 10 dishes, one per person', () => assertDishCount(w, 10));
    And("A may score every dish except A's own and B's", () => assertMayScoreAllExcept(w, 'A', ['A', 'B']));
    And('A may give each category a score from 1 to 8', () => assertRange(w, 'A', 1, 8));
    And("I may score every dish except I's own", () => assertMayScoreAllExcept(w, 'I', ['I']));
    And('I may give each category a score from 1 to 9', () => assertRange(w, 'I', 1, 9));
  });

  Scenario('Somebody without a partner is welcome and scores everybody', ({ Given, And, When, Then }) => {
    const w = freshWorld();
    Given('a contest where everyone is on their own with partners kept apart', () => void (w.format = 'solo_with_partners'));
    And('the score range is fixed from 1 to 10', () => void (w.range = { type: 'fixed', min: 1, max: 10 }));
    And('the participants are:', (_ctx, table: Row[]) => void (w.participants = parseParticipants(table)));
    When('the contest is prepared for scoring', () => void (w.result = compile(buildDraft(w))));
    Then('there are 3 dishes, one per person', () => assertDishCount(w, 3));
    And("A may score every dish except A's own and B's", () => assertMayScoreAllExcept(w, 'A', ['A', 'B']));
    And("I may score every dish except I's own", () => assertMayScoreAllExcept(w, 'I', ['I']));
  });

  Scenario('A couple cooks one dish and neither of them scores it', ({ Given, And, When, Then }) => {
    const w = freshWorld();
    Given('a contest where couples cook together', () => void (w.format = 'couples'));
    And('scores in a category may repeat', () => void (w.uniquePerCategory = false));
    And('the score range is fixed from 1 to 10', () => void (w.range = { type: 'fixed', min: 1, max: 10 }));
    And('the participants are:', (_ctx, table: Row[]) => void (w.participants = parseParticipants(table)));
    When('the contest is prepared for scoring', () => void (w.result = compile(buildDraft(w))));
    Then('there are 3 dishes, one per couple', () => assertDishCount(w, 3));
    And('A and B share one dish', () => assertShareDish(w, 'A', 'B'));
    And("A may score every dish except A and B's shared dish", () => assertMayScoreAllExcept(w, 'A', ['A', 'B']));
    And("B may score every dish except A and B's shared dish", () => assertMayScoreAllExcept(w, 'B', ['A', 'B']));
    And('A may give each category a score from 1 to 10', () => assertRange(w, 'A', 1, 10));
  });

  Scenario('Keeping a couple apart needs no rule of its own here', ({ Given, And, When, Then }) => {
    const w = freshWorld();
    Given('a contest where couples cook together', () => void (w.format = 'couples'));
    And('the score range adjusts to how many dishes a judge can score', () => void (w.range = { type: 'auto' }));
    And('the participants are:', (_ctx, table: Row[]) => void (w.participants = parseParticipants(table)));
    When('the contest is prepared for scoring', () => void (w.result = compile(buildDraft(w))));
    Then('there are 2 dishes, one per couple', () => assertDishCount(w, 2));
    And('A may give each category a score from 1 to 1', () => assertRange(w, 'A', 1, 1));
    And('A and B may score exactly the same dishes', () => assertSameDishes(w, 'A', 'B'));
  });

  Scenario('A partner reference with no matching person is rejected', ({ Given, And, When, Then }) => {
    const w = freshWorld();
    Given('a contest where everyone is on their own', () => void (w.format = 'solo'));
    And('the participants are:', (_ctx, table: Row[]) => void (w.participants = parseParticipants(table)));
    When('the contest is prepared for scoring', () => void (w.result = compile(buildDraft(w))));
    Then('preparing the contest is rejected because a partner is missing', () => assertRejected(w, 'MISSING_PARTNER'));
  });

  Scenario('A partnership only one of them claims is rejected', ({ Given, And, When, Then }) => {
    const w = freshWorld();
    Given('a contest where everyone is on their own with partners kept apart', () => void (w.format = 'solo_with_partners'));
    And('the participants are:', (_ctx, table: Row[]) => void (w.participants = parseParticipants(table)));
    When('the contest is prepared for scoring', () => void (w.result = compile(buildDraft(w))));
    Then('preparing the contest is rejected because a partnership is not reciprocal', () =>
      assertRejected(w, 'INCONSISTENT_PARTNER'));
  });

  Scenario('A judge who can score no dishes is rejected', ({ Given, And, When, Then }) => {
    const w = freshWorld();
    Given('a contest where everyone is on their own with partners kept apart', () => void (w.format = 'solo_with_partners'));
    And('the participants are:', (_ctx, table: Row[]) => void (w.participants = parseParticipants(table)));
    When('the contest is prepared for scoring', () => void (w.result = compile(buildDraft(w))));
    Then('preparing the contest is rejected because a judge could score nothing', () =>
      assertRejected(w, 'JUDGE_CANNOT_SCORE_ANY_DISH'));
  });

  Scenario('Couples cooking together with somebody unpartnered is rejected', ({ Given, And, When, Then }) => {
    const w = freshWorld();
    Given('a contest where couples cook together', () => void (w.format = 'couples'));
    And('the participants are:', (_ctx, table: Row[]) => void (w.participants = parseParticipants(table)));
    When('the contest is prepared for scoring', () => void (w.result = compile(buildDraft(w))));
    Then('preparing the contest is rejected because a participant has no partner', () =>
      assertRejected(w, 'UNPARTNERED_IN_COUPLES'));
  });
});
