import type { MaterializedContest } from '@tapas/domain';
import { describe, expect, it } from 'vitest';
import { SaveScore, SendVote, type Clock } from '../../../../src/index.js';
import { FakeContestRepository } from '../../contests/support.js';
import { FakeRosterRepository } from '../../voters/support.js';
import { FakeVoteSessionRepository } from '../support.js';

const clock: Clock = { now: () => '2026-07-21T10:00:00.000Z' };

/** Ana may score Bob's dish, 1..5, in two categories: taste and presentation. */
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
    categories: [
      { id: 'taste', name: 'Taste' },
      { id: 'presentation', name: 'Presentation' },
    ],
  };
}

function makeEnv(closeRule: { readonly when: 'host_trigger' | 'all_sent' } = { when: 'host_trigger' }) {
  const contests = new FakeContestRepository();
  contests.insert({
    id: 'contest-1',
    hostId: 'host-1',
    name: 'Tapas',
    joinCode: 'TAPAS1',
    status: 'live',
    materialized: materialized(),
    createdAt: '2026-07-20T10:00:00.000Z',
    closeRule,
    revealStrategy: { when: 'host_trigger' },
    closedAt: null,
    revealedAt: null,
  });
  const voteSessions = new FakeVoteSessionRepository();
  const roster = new FakeRosterRepository();
  roster.seed('contest-1', [
    { participantId: 'ana', displayName: 'Ana' },
    { participantId: 'bob', displayName: 'Bob' },
  ]);
  roster.claim('contest-1', 'ana', '2026-07-20T10:00:00.000Z');
  roster.claim('contest-1', 'bob', '2026-07-20T10:00:00.000Z');
  let sequence = 0;
  const ids = { next: () => `id-${++sequence}` };
  return {
    saveScore: new SaveScore({ contests, voteSessions, ids, clock }),
    sendVote: new SendVote({ contests, voteSessions, roster, clock }),
    voteSessions,
    contests,
  };
}

describe('SendVote', () => {
  it('sends a complete vote, locking the session', () => {
    const { saveScore, sendVote, voteSessions } = makeEnv();
    saveScore.execute('contest-1', 'ana', { dishId: 'D-bob', categoryId: 'taste', value: 4 });
    saveScore.execute('contest-1', 'ana', {
      dishId: 'D-bob',
      categoryId: 'presentation',
      value: 3,
    });

    const outcome = sendVote.execute('contest-1', 'ana');

    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.session.status).toBe('sent');
    expect(voteSessions.findSession('contest-1', 'ana')?.status).toBe('sent');
  });

  it('refuses to send when no vote session exists yet', () => {
    const { sendVote } = makeEnv();
    const outcome = sendVote.execute('contest-1', 'ana');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('NO_VOTE_SESSION');
  });

  it('propagates the domain INCOMPLETE error when a category is left unscored', () => {
    const { saveScore, sendVote } = makeEnv();
    saveScore.execute('contest-1', 'ana', { dishId: 'D-bob', categoryId: 'taste', value: 4 });
    // "presentation" never scored.

    const outcome = sendVote.execute('contest-1', 'ana');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('INCOMPLETE');
  });

  it('refuses to send twice', () => {
    const { saveScore, sendVote } = makeEnv();
    saveScore.execute('contest-1', 'ana', { dishId: 'D-bob', categoryId: 'taste', value: 4 });
    saveScore.execute('contest-1', 'ana', {
      dishId: 'D-bob',
      categoryId: 'presentation',
      value: 3,
    });
    sendVote.execute('contest-1', 'ana');

    const secondAttempt = sendVote.execute('contest-1', 'ana');

    expect(secondAttempt.ok).toBe(false);
    if (!secondAttempt.ok) expect(secondAttempt.error.code).toBe('ALREADY_SENT');
  });

  it('reports CONTEST_NOT_FOUND for an unknown contest', () => {
    const { sendVote } = makeEnv();
    const outcome = sendVote.execute('ghost-contest', 'ana');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('CONTEST_NOT_FOUND');
  });

  it('refuses to send once the contest has closed', () => {
    const { saveScore, sendVote, contests } = makeEnv();
    saveScore.execute('contest-1', 'ana', { dishId: 'D-bob', categoryId: 'taste', value: 4 });
    saveScore.execute('contest-1', 'ana', {
      dishId: 'D-bob',
      categoryId: 'presentation',
      value: 3,
    });
    contests.updateStatus('contest-1', 'closed', clock.now(), null);

    const outcome = sendVote.execute('contest-1', 'ana');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('CONTEST_CLOSED');
  });

  it('auto-closes once every claimed participant has sent, under an all_sent rule', () => {
    const { saveScore, sendVote, contests } = makeEnv({ when: 'all_sent' });
    saveScore.execute('contest-1', 'ana', { dishId: 'D-bob', categoryId: 'taste', value: 4 });
    saveScore.execute('contest-1', 'ana', {
      dishId: 'D-bob',
      categoryId: 'presentation',
      value: 3,
    });
    saveScore.execute('contest-1', 'bob', { dishId: 'D-ana', categoryId: 'taste', value: 5 });
    saveScore.execute('contest-1', 'bob', {
      dishId: 'D-ana',
      categoryId: 'presentation',
      value: 4,
    });

    sendVote.execute('contest-1', 'ana');
    expect(contests.findById('contest-1')?.status).toBe('live'); // bob hasn't sent yet

    sendVote.execute('contest-1', 'bob');
    expect(contests.findById('contest-1')?.status).toBe('closed');
  });
});

describe('SaveScore (post-send lock)', () => {
  it('refuses to save a new score once the vote has been sent', () => {
    const { saveScore, sendVote } = makeEnv();
    saveScore.execute('contest-1', 'ana', { dishId: 'D-bob', categoryId: 'taste', value: 4 });
    saveScore.execute('contest-1', 'ana', {
      dishId: 'D-bob',
      categoryId: 'presentation',
      value: 3,
    });
    sendVote.execute('contest-1', 'ana');

    const outcome = saveScore.execute('contest-1', 'ana', {
      dishId: 'D-bob',
      categoryId: 'taste',
      value: 5,
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('SESSION_LOCKED');
  });
});
