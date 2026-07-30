import type { MaterializedContest } from '@tapas/domain';
import { describe, expect, it } from 'vitest';
import { GetTally } from '../../../../src/index.js';
import { FakeContestRepository } from '../support.js';
import { FakeRosterRepository } from '../../voters/support.js';
import { FakeVoteSessionRepository } from '../../scoring/support.js';

function materialized(): MaterializedContest {
  return {
    dishes: [
      { id: 'D-ana', submitterIds: ['ana'] },
      { id: 'D-bob', submitterIds: ['bob'] },
      { id: 'D-carol', submitterIds: ['carol'] },
    ],
    allowedVoters: new Map(),
    scoreRangeByVoter: new Map(),
    uniquePerCategory: false,
    categories: [{ id: 'taste', name: 'Taste' }],
  };
}

function liveContest() {
  return {
    id: 'contest-1',
    hostId: 'host-1',
    name: 'Tapas',
    joinCode: 'JOIN-1',
    status: 'live' as const,
    materialized: materialized(),
    closeRule: { when: 'host_trigger' as const },
    revealStrategy: { when: 'host_trigger' as const },
    createdAt: '2026-07-19T10:00:00.000Z',
    closedAt: null,
    revealedAt: null,
  };
}

describe('GetTally', () => {
  it('counts claimed places, draft sessions, and sent sessions', () => {
    const contests = new FakeContestRepository();
    contests.insert(liveContest());
    const roster = new FakeRosterRepository();
    roster.seed('contest-1', [
      { participantId: 'ana', displayName: 'Ana' },
      { participantId: 'bob', displayName: 'Bob' },
      { participantId: 'carol', displayName: 'Carol' },
    ]);
    roster.claim('contest-1', 'ana', '2026-07-20T09:00:00.000Z');
    roster.claim('contest-1', 'bob', '2026-07-20T09:00:00.000Z');
    // Carol never claims — should not count toward claimedCount.

    const voteSessions = new FakeVoteSessionRepository();
    voteSessions.createSession({
      id: 'vs-ana',
      contestId: 'contest-1',
      voterId: 'ana',
      status: 'draft',
      createdAt: '2026-07-20T09:05:00.000Z',
      submittedAt: null,
    });
    voteSessions.createSession({
      id: 'vs-bob',
      contestId: 'contest-1',
      voterId: 'bob',
      status: 'sent',
      createdAt: '2026-07-20T09:05:00.000Z',
      submittedAt: '2026-07-20T09:10:00.000Z',
    });

    const outcome = new GetTally({ contests, roster, voteSessions }).execute('contest-1');

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // Three places, two of them claimed — the total is what the rest is out of.
    expect(outcome.tally).toEqual({
      placeCount: 3,
      claimedCount: 2,
      draftCount: 1,
      sentCount: 1,
    });
  });

  it('reports how many places there are even when nobody has claimed one', () => {
    const contests = new FakeContestRepository();
    contests.insert(liveContest());
    const roster = new FakeRosterRepository();
    roster.seed('contest-1', [
      { participantId: 'ana', displayName: 'Ana' },
      { participantId: 'bob', displayName: 'Bob' },
    ]);

    const outcome = new GetTally({
      contests,
      roster,
      voteSessions: new FakeVoteSessionRepository(),
    }).execute('contest-1');

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // Two places and nobody in them: "none of two", not "none of nothing".
    expect(outcome.tally).toEqual({
      placeCount: 2,
      claimedCount: 0,
      draftCount: 0,
      sentCount: 0,
    });
  });

  it('reports CONTEST_NOT_FOUND for an unknown contest', () => {
    const contests = new FakeContestRepository();
    const roster = new FakeRosterRepository();
    const voteSessions = new FakeVoteSessionRepository();

    const outcome = new GetTally({ contests, roster, voteSessions }).execute('unknown');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('CONTEST_NOT_FOUND');
  });
});
