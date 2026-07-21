import { describe, expect, it } from 'vitest';
import { VoteSession, type MaterializedContest, type ScoreInput } from '../../../src/index.js';

const nowIso = '2026-07-21T10:00:00.000Z';

/** Ana may score 3 dishes (Bob, Carol, Dave), 2 categories: taste, presentation. Not unique per category. */
function repeatsAllowedMaterialized(): MaterializedContest {
  return {
    dishes: [
      { id: 'D-bob', submitterIds: ['bob'] },
      { id: 'D-carol', submitterIds: ['carol'] },
      { id: 'D-dave', submitterIds: ['dave'] },
    ],
    allowedVoters: new Map([
      ['D-bob', new Set(['ana'])],
      ['D-carol', new Set(['ana'])],
      ['D-dave', new Set(['ana'])],
    ]),
    scoreRangeByVoter: new Map([['ana', { min: 1, max: 3 }]]),
    uniquePerCategory: false,
    categories: [
      { id: 'taste', name: 'Taste' },
      { id: 'presentation', name: 'Presentation' },
    ],
  };
}

/** Same 3 dishes, but a strict ranking is required: each category's scores must be a 1..3 permutation. */
function rankingMaterialized(): MaterializedContest {
  return { ...repeatsAllowedMaterialized(), uniquePerCategory: true };
}

function scoresFor(dishToValue: Record<string, number>, categoryIds: string[]): ScoreInput[] {
  return categoryIds.flatMap((categoryId) =>
    Object.entries(dishToValue).map(([dishId, value]) => ({ dishId, categoryId, value })),
  );
}

describe('VoteSession', () => {
  it('sends successfully once every allowed dish is scored in every category', () => {
    const session = VoteSession.start('vs-1', 'contest-1', 'ana', nowIso);
    const scores = scoresFor({ 'D-bob': 3, 'D-carol': 1, 'D-dave': 2 }, ['taste', 'presentation']);

    const result = session.send(repeatsAllowedMaterialized(), scores, nowIso);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.status).toBe('sent');
      expect(result.session.submittedAt).toBe(nowIso);
    }
  });

  it('refuses to send an incomplete vote (a dish left unscored)', () => {
    const session = VoteSession.start('vs-1', 'contest-1', 'ana', nowIso);
    // Missing D-dave entirely.
    const scores = scoresFor({ 'D-bob': 3, 'D-carol': 1 }, ['taste', 'presentation']);

    const result = session.send(repeatsAllowedMaterialized(), scores, nowIso);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INCOMPLETE');
  });

  it('refuses to send an incomplete vote (a category left unscored)', () => {
    const session = VoteSession.start('vs-1', 'contest-1', 'ana', nowIso);
    // "presentation" never scored at all.
    const scores = scoresFor({ 'D-bob': 3, 'D-carol': 1, 'D-dave': 2 }, ['taste']);

    const result = session.send(repeatsAllowedMaterialized(), scores, nowIso);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INCOMPLETE');
  });

  it('allows repeated scores in a category when uniquePerCategory is false', () => {
    const session = VoteSession.start('vs-1', 'contest-1', 'ana', nowIso);
    const scores = scoresFor({ 'D-bob': 2, 'D-carol': 2, 'D-dave': 2 }, ['taste', 'presentation']);

    const result = session.send(repeatsAllowedMaterialized(), scores, nowIso);

    expect(result.ok).toBe(true);
  });

  it('refuses a ranking vote where a category repeats a value', () => {
    const session = VoteSession.start('vs-1', 'contest-1', 'ana', nowIso);
    // "taste" has two dishes scored 2 — not a 1..3 permutation.
    const scores = [
      { dishId: 'D-bob', categoryId: 'taste', value: 2 },
      { dishId: 'D-carol', categoryId: 'taste', value: 2 },
      { dishId: 'D-dave', categoryId: 'taste', value: 1 },
      ...scoresFor({ 'D-bob': 3, 'D-carol': 1, 'D-dave': 2 }, ['presentation']),
    ];

    const result = session.send(rankingMaterialized(), scores, nowIso);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DUPLICATE_CATEGORY_VALUE');
  });

  it('accepts a valid ranking (each category a full 1..N permutation)', () => {
    const session = VoteSession.start('vs-1', 'contest-1', 'ana', nowIso);
    const scores = [
      ...scoresFor({ 'D-bob': 3, 'D-carol': 1, 'D-dave': 2 }, ['taste']),
      ...scoresFor({ 'D-bob': 1, 'D-carol': 2, 'D-dave': 3 }, ['presentation']),
    ];

    const result = session.send(rankingMaterialized(), scores, nowIso);

    expect(result.ok).toBe(true);
  });

  it('refuses to send an already-sent session', () => {
    const session = VoteSession.start('vs-1', 'contest-1', 'ana', nowIso);
    const scores = scoresFor({ 'D-bob': 3, 'D-carol': 1, 'D-dave': 2 }, ['taste', 'presentation']);
    const sent = session.send(repeatsAllowedMaterialized(), scores, nowIso);
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;

    const secondAttempt = sent.session.send(repeatsAllowedMaterialized(), scores, nowIso);

    expect(secondAttempt.ok).toBe(false);
    if (!secondAttempt.ok) expect(secondAttempt.error.code).toBe('ALREADY_SENT');
  });

  it('rehydrates a sent session that reports isSent', () => {
    const session = VoteSession.rehydrate('vs-1', 'contest-1', 'ana', 'sent', nowIso, nowIso);
    expect(session.isSent).toBe(true);
  });
});
