import { describe, expect, it } from 'vitest';
import { RevealContest } from '../../../../src/index.js';
import { FakeContestRepository } from '../support.js';

function contestWith(overrides: Partial<Parameters<FakeContestRepository['insert']>[0]> = {}) {
  return {
    id: 'contest-1',
    hostId: 'host-1',
    name: 'Summer',
    joinCode: 'JOIN-1',
    status: 'closed' as const,
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
    closedAt: '2026-07-20T10:00:00.000Z',
    revealedAt: null,
    ...overrides,
  };
}

describe('RevealContest', () => {
  it('reveals a closed contest', () => {
    const contests = new FakeContestRepository();
    contests.insert(contestWith());
    const clock = { now: () => '2026-07-21T10:00:00.000Z' };

    const outcome = new RevealContest({ contests, clock }).execute('contest-1');

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.contest.status).toBe('revealed');
    expect(outcome.contest.revealedAt).toBe('2026-07-21T10:00:00.000Z');
    expect(contests.findById('contest-1')?.status).toBe('revealed');
  });

  it('reports CONTEST_NOT_FOUND for an unknown contest', () => {
    const contests = new FakeContestRepository();
    const clock = { now: () => '2026-07-21T10:00:00.000Z' };

    const outcome = new RevealContest({ contests, clock }).execute('unknown');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('CONTEST_NOT_FOUND');
  });

  it('refuses to reveal a contest that has not closed yet', () => {
    const contests = new FakeContestRepository();
    contests.insert(contestWith({ status: 'live', closedAt: null }));
    const clock = { now: () => '2026-07-21T10:00:00.000Z' };

    const outcome = new RevealContest({ contests, clock }).execute('contest-1');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('NOT_CLOSED');
  });

  it('refuses to reveal an already-revealed contest', () => {
    const contests = new FakeContestRepository();
    contests.insert(contestWith({ status: 'revealed', revealedAt: '2026-07-20T11:00:00.000Z' }));
    const clock = { now: () => '2026-07-21T10:00:00.000Z' };

    const outcome = new RevealContest({ contests, clock }).execute('contest-1');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('ALREADY_REVEALED');
  });
});
