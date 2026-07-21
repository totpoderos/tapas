import { describe, expect, it } from 'vitest';
import { ensureContestFresh } from '../../../src/index.js';
import { FakeContestRepository } from './support.js';

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

describe('ensureContestFresh', () => {
  it('closes a scheduled contest once its time has passed', () => {
    const contests = new FakeContestRepository();
    const scheduled = liveContest({ closeRule: { when: 'scheduled', at: '2026-07-21T10:00:00.000Z' } });
    contests.insert(scheduled);
    const clock = { now: () => '2026-07-21T10:00:01.000Z' };

    const fresh = ensureContestFresh(scheduled, { contests, clock });

    expect(fresh.status).toBe('closed');
    expect(fresh.closedAt).toBe('2026-07-21T10:00:01.000Z');
    expect(contests.findById('contest-1')?.status).toBe('closed');
  });

  it('leaves a scheduled contest untouched before its time', () => {
    const contests = new FakeContestRepository();
    const scheduled = liveContest({ closeRule: { when: 'scheduled', at: '2026-07-21T10:00:00.000Z' } });
    contests.insert(scheduled);
    const clock = { now: () => '2026-07-21T09:59:59.000Z' };

    const fresh = ensureContestFresh(scheduled, { contests, clock });

    expect(fresh.status).toBe('live');
    expect(contests.findById('contest-1')?.status).toBe('live');
  });

  it('leaves a host_trigger contest untouched regardless of the clock', () => {
    const contests = new FakeContestRepository();
    const contest = liveContest();
    contests.insert(contest);
    const clock = { now: () => '2099-01-01T00:00:00.000Z' };

    const fresh = ensureContestFresh(contest, { contests, clock });

    expect(fresh.status).toBe('live');
  });

  it('leaves an already-closed contest untouched', () => {
    const contests = new FakeContestRepository();
    const closed = liveContest({
      status: 'closed',
      closedAt: '2026-07-20T10:00:00.000Z',
      closeRule: { when: 'scheduled', at: '2026-07-19T10:00:00.000Z' },
    });
    contests.insert(closed);
    const clock = { now: () => '2026-07-21T10:00:00.000Z' };

    const fresh = ensureContestFresh(closed, { contests, clock });

    expect(fresh.status).toBe('closed');
    expect(fresh.closedAt).toBe('2026-07-20T10:00:00.000Z');
  });

  it('reveals a closed contest once its scheduled reveal time has passed', () => {
    const contests = new FakeContestRepository();
    const closed = liveContest({
      status: 'closed',
      closedAt: '2026-07-20T10:00:00.000Z',
      revealStrategy: { when: 'scheduled', at: '2026-07-21T10:00:00.000Z' },
    });
    contests.insert(closed);
    const clock = { now: () => '2026-07-21T10:00:01.000Z' };

    const fresh = ensureContestFresh(closed, { contests, clock });

    expect(fresh.status).toBe('revealed');
    expect(fresh.revealedAt).toBe('2026-07-21T10:00:01.000Z');
    expect(contests.findById('contest-1')?.status).toBe('revealed');
  });

  it('leaves a closed contest untouched before its scheduled reveal time', () => {
    const contests = new FakeContestRepository();
    const closed = liveContest({
      status: 'closed',
      closedAt: '2026-07-20T10:00:00.000Z',
      revealStrategy: { when: 'scheduled', at: '2026-07-21T10:00:00.000Z' },
    });
    contests.insert(closed);
    const clock = { now: () => '2026-07-21T09:59:59.000Z' };

    const fresh = ensureContestFresh(closed, { contests, clock });

    expect(fresh.status).toBe('closed');
  });

  it('does not reveal a live contest even if its scheduled reveal time has passed', () => {
    const contests = new FakeContestRepository();
    const stillLive = liveContest({
      revealStrategy: { when: 'scheduled', at: '2026-07-21T10:00:00.000Z' },
    });
    contests.insert(stillLive);
    const clock = { now: () => '2026-07-21T10:00:01.000Z' };

    const fresh = ensureContestFresh(stillLive, { contests, clock });

    expect(fresh.status).toBe('live');
  });

  it('closes and reveals in the same pass when both times have arrived', () => {
    const contests = new FakeContestRepository();
    const scheduled = liveContest({
      closeRule: { when: 'scheduled', at: '2026-07-21T09:00:00.000Z' },
      revealStrategy: { when: 'scheduled', at: '2026-07-21T09:30:00.000Z' },
    });
    contests.insert(scheduled);
    const clock = { now: () => '2026-07-21T10:00:00.000Z' };

    const fresh = ensureContestFresh(scheduled, { contests, clock });

    expect(fresh.status).toBe('revealed');
    expect(fresh.closedAt).toBe('2026-07-21T10:00:00.000Z');
    expect(fresh.revealedAt).toBe('2026-07-21T10:00:00.000Z');
  });
});
