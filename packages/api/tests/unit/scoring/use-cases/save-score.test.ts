import type { MaterializedContest } from '@tapas/domain';
import { describe, expect, it } from 'vitest';
import { GetMyScores, SaveScore, type Clock } from '../../../../src/index.js';
import { FakeContestRepository } from '../../contests/support.js';
import { FakeVoteSessionRepository } from '../support.js';

const clock: Clock = { now: () => '2026-07-21T10:00:00.000Z' };

function materialized(): MaterializedContest {
  return {
    dishes: [
      { id: 'D-ana', submitterIds: ['ana'] },
      { id: 'D-bob', submitterIds: ['bob'] },
    ],
    allowedVoters: new Map([
      ['D-ana', new Set(['bob'])],
      ['D-bob', new Set(['ana'])],
    ]),
    scoreRangeByVoter: new Map([
      ['ana', { min: 1, max: 5 }],
      ['bob', { min: 1, max: 5 }],
    ]),
    uniquePerCategory: false,
    categories: [{ id: 'taste', name: 'Taste' }],
  };
}

function makeEnv() {
  const contests = new FakeContestRepository();
  contests.insert({
    id: 'contest-1',
    hostId: 'host-1',
    name: 'Tapas',
    joinCode: 'TAPAS1',
    status: 'live',
    materialized: materialized(),
    createdAt: '2026-07-20T10:00:00.000Z',
    closeRule: { when: 'host_trigger' },
    revealStrategy: { when: 'host_trigger' },
    closedAt: null,
    revealedAt: null,
  });
  const voteSessions = new FakeVoteSessionRepository();
  let sequence = 0;
  const ids = { next: () => `id-${++sequence}` };
  return {
    saveScore: new SaveScore({ contests, voteSessions, ids, clock }),
    getMyScores: new GetMyScores({ voteSessions }),
    voteSessions,
    contests,
  };
}

describe('SaveScore', () => {
  it('saves a score for a dish open to the voter, creating their vote session', () => {
    const { saveScore, voteSessions } = makeEnv();

    const outcome = saveScore.execute('contest-1', 'ana', {
      dishId: 'D-bob',
      categoryId: 'taste',
      value: 4,
    });

    expect(outcome.ok).toBe(true);
    expect(voteSessions.findSession('contest-1', 'ana')?.status).toBe('draft');
  });

  it('revises the same score rather than adding a second', () => {
    const { saveScore, getMyScores } = makeEnv();

    saveScore.execute('contest-1', 'ana', { dishId: 'D-bob', categoryId: 'taste', value: 4 });
    saveScore.execute('contest-1', 'ana', { dishId: 'D-bob', categoryId: 'taste', value: 5 });

    const scores = getMyScores.execute('contest-1', 'ana');
    expect(scores).toHaveLength(1);
    expect(scores[0]?.value).toBe(5);
  });

  it('refuses a dish not open to the voter', () => {
    const { saveScore } = makeEnv();

    const outcome = saveScore.execute('contest-1', 'ana', {
      dishId: 'D-ana',
      categoryId: 'taste',
      value: 4,
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('DISH_NOT_OPEN');
  });

  it('refuses an out-of-range score', () => {
    const { saveScore } = makeEnv();

    const outcome = saveScore.execute('contest-1', 'ana', {
      dishId: 'D-bob',
      categoryId: 'taste',
      value: 9,
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('OUT_OF_RANGE');
  });

  it('refuses an unknown category', () => {
    const { saveScore } = makeEnv();

    const outcome = saveScore.execute('contest-1', 'ana', {
      dishId: 'D-bob',
      categoryId: 'ghost',
      value: 4,
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('UNKNOWN_CATEGORY');
  });

  it('reports CONTEST_NOT_FOUND for an unknown contest', () => {
    const { saveScore } = makeEnv();

    const outcome = saveScore.execute('ghost-contest', 'ana', {
      dishId: 'D-bob',
      categoryId: 'taste',
      value: 4,
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('CONTEST_NOT_FOUND');
  });

  it('refuses to save once the contest has closed', () => {
    const { saveScore, contests } = makeEnv();
    contests.updateStatus('contest-1', 'closed', clock.now(), null);

    const outcome = saveScore.execute('contest-1', 'ana', {
      dishId: 'D-bob',
      categoryId: 'taste',
      value: 4,
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('CONTEST_CLOSED');
  });
});

describe('GetMyScores', () => {
  it('returns no scores before a voter has saved any', () => {
    const { getMyScores } = makeEnv();
    expect(getMyScores.execute('contest-1', 'ana')).toEqual([]);
  });

  it("returns a voter's saved scores", () => {
    const { saveScore, getMyScores } = makeEnv();
    saveScore.execute('contest-1', 'ana', { dishId: 'D-bob', categoryId: 'taste', value: 4 });

    const scores = getMyScores.execute('contest-1', 'ana');

    expect(scores).toHaveLength(1);
    expect(scores[0]?.dishId).toBe('D-bob');
  });
});
