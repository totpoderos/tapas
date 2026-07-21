import { describe, expect, it } from 'vitest';
import { CloseContest } from '../../../../src/index.js';
import { FakeContestRepository } from '../support.js';

function liveContest(overrides: Partial<Parameters<FakeContestRepository['insert']>[0]> = {}) {
  return {
    id: 'contest-1',
    hostId: 'host-1',
    name: 'Summer',
    joinCode: 'JOIN-1',
    status: 'live' as const,
    materialized: {
      dishes: [],
      allowedVoters: new Map(),
      scoreRangeByVoter: new Map(),
      uniquePerCategory: true,
      categories: [],
    },
    closeRule: { when: 'host_trigger' as const },
    revealStrategy: { when: 'host_trigger' as const },
    createdAt: '2026-07-19T10:00:00.000Z',
    closedAt: null,
    revealedAt: null,
    ...overrides,
  };
}

describe('CloseContest', () => {
  it('closes a live contest', () => {
    const contests = new FakeContestRepository();
    contests.insert(liveContest());
    const clock = { now: () => '2026-07-21T10:00:00.000Z' };

    const outcome = new CloseContest({ contests, clock }).execute('contest-1');

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.contest.status).toBe('closed');
    expect(outcome.contest.closedAt).toBe('2026-07-21T10:00:00.000Z');
    expect(contests.findById('contest-1')?.status).toBe('closed');
  });

  it('reports CONTEST_NOT_FOUND for an unknown contest', () => {
    const contests = new FakeContestRepository();
    const clock = { now: () => '2026-07-21T10:00:00.000Z' };

    const outcome = new CloseContest({ contests, clock }).execute('unknown');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('CONTEST_NOT_FOUND');
  });

  it('refuses to close an already-closed contest', () => {
    const contests = new FakeContestRepository();
    contests.insert(liveContest({ status: 'closed', closedAt: '2026-07-20T10:00:00.000Z' }));
    const clock = { now: () => '2026-07-21T10:00:00.000Z' };

    const outcome = new CloseContest({ contests, clock }).execute('contest-1');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('ALREADY_CLOSED');
  });
});
