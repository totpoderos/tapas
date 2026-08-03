import type { MaterializedContest } from '@tapas/domain';
import { describe, expect, it } from 'vitest';
import { GetResults } from '../../../../src/index.js';
import { FakeContestRepository } from '../support.js';
import { FakeVoteSessionRepository } from '../../scoring/support.js';

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

function contestWith(status: 'live' | 'closed' | 'revealed') {
  return {
    id: 'contest-1',
    hostId: 'host-1',
    name: 'Tapas',
    joinCode: 'JOIN-1',
    status,
    materialized: materialized(),
    closeRule: { when: 'host_trigger' as const },
    revealStrategy: { when: 'host_trigger' as const },
    createdAt: '2026-07-19T10:00:00.000Z',
    closedAt: status === 'live' ? null : '2026-07-20T10:00:00.000Z',
    revealedAt: status === 'revealed' ? '2026-07-21T10:00:00.000Z' : null,
  };
}

describe('GetResults', async () => {
  it('tallies only sent votes for a revealed contest', async () => {
    const contests = new FakeContestRepository();
    await contests.insert(contestWith('revealed'));
    const voteSessions = new FakeVoteSessionRepository();
    await voteSessions.createSession({
      id: 'vs-ana',
      contestId: 'contest-1',
      voterId: 'ana',
      status: 'sent',
      createdAt: '2026-07-20T09:00:00.000Z',
      submittedAt: '2026-07-20T09:05:00.000Z',
    });
    await voteSessions.upsertScore({
      id: 'score-1',
      voteSessionId: 'vs-ana',
      dishId: 'D-bob',
      categoryId: 'taste',
      value: 4,
    });
    // Bob's session was never sent — must not count toward the tally.
    await voteSessions.createSession({
      id: 'vs-bob',
      contestId: 'contest-1',
      voterId: 'bob',
      status: 'draft',
      createdAt: '2026-07-20T09:00:00.000Z',
      submittedAt: null,
    });
    await voteSessions.upsertScore({
      id: 'score-2',
      voteSessionId: 'vs-bob',
      dishId: 'D-ana',
      categoryId: 'taste',
      value: 5,
    });

    const outcome = await new GetResults({ contests, voteSessions }).execute('contest-1');

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const taste = outcome.results.categories.find((c) => c.categoryId === 'taste');
    expect(taste?.totals.get('D-bob')).toBe(4);
    expect(taste?.totals.get('D-ana')).toBe(0);
  });

  it('reports CONTEST_NOT_FOUND for an unknown contest', async () => {
    const contests = new FakeContestRepository();
    const voteSessions = new FakeVoteSessionRepository();

    const outcome = await new GetResults({ contests, voteSessions }).execute('unknown');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('CONTEST_NOT_FOUND');
  });

  it('refuses to return results before the contest has been revealed', async () => {
    const contests = new FakeContestRepository();
    await contests.insert(contestWith('closed'));
    const voteSessions = new FakeVoteSessionRepository();

    const outcome = await new GetResults({ contests, voteSessions }).execute('contest-1');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('NOT_REVEALED');
  });
});
