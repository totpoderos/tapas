import type { MaterializedContest } from '@tapas/domain';
import { describe, expect, it } from 'vitest';
import { GetTurnout } from '../../../../src/index.js';
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

function session(voterId: string, status: 'draft' | 'sent') {
  return {
    id: `vs-${voterId}`,
    contestId: 'contest-1',
    voterId,
    status,
    createdAt: '2026-07-20T09:05:00.000Z',
    submittedAt: status === 'sent' ? '2026-07-20T09:10:00.000Z' : null,
  };
}

/** Ana sent, Bob is part-way through, Carol never claimed a place. */
async function roomOfThree() {
  const contests = new FakeContestRepository();
  await contests.insert(liveContest());
  const roster = new FakeRosterRepository();
  await roster.seed('contest-1', [
    { participantId: 'ana', displayName: 'Ana' },
    { participantId: 'bob', displayName: 'Bob' },
    { participantId: 'carol', displayName: 'Carol' },
  ]);
  await roster.claim('contest-1', 'ana', '2026-07-20T09:00:00.000Z');
  await roster.claim('contest-1', 'bob', '2026-07-20T09:00:00.000Z');
  const voteSessions = new FakeVoteSessionRepository();
  await voteSessions.createSession(session('ana', 'sent'));
  await voteSessions.createSession(session('bob', 'draft'));
  return { contests, roster, voteSessions };
}

describe('GetTurnout', async () => {
  it('says how many votes are in, out of how many are expected', async () => {
    const outcome = await new GetTurnout(await roomOfThree()).execute('contest-1');

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // Out of every place the host listed — including Carol's, which nobody took.
    // A place nobody claimed can never produce a vote, so counting only the
    // claimed ones would read "everyone has voted" while the reveal never comes.
    expect(outcome.turnout.votesIn).toBe(1);
    expect(outcome.turnout.votesExpected).toBe(3);
  });

  it('names who has still to vote, and who is in', async () => {
    const outcome = await new GetTurnout(await roomOfThree()).execute('contest-1');

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.turnout.participants).toEqual([
      { participantId: 'ana', displayName: 'Ana', sent: true },
      { participantId: 'bob', displayName: 'Bob', sent: false },
      { participantId: 'carol', displayName: 'Carol', sent: false },
    ]);
  });

  /*
   * The disclosure boundary, asserted rather than described. Bob has a draft
   * session with scores in it; Carol has no session at all. To anyone else they
   * must look the same — "not in" — because how far through someone is, is that
   * person's business, and the shape of this answer is what decides that.
   */
  it('does not distinguish a part-scored vote from one not started', async () => {
    const { contests, roster, voteSessions } = await roomOfThree();
    await voteSessions.upsertScore({
      id: 's-1',
      voteSessionId: 'vs-bob',
      dishId: 'D-ana',
      categoryId: 'taste',
      value: 4,
    });

    const outcome = await new GetTurnout({ contests, roster, voteSessions }).execute('contest-1');

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const bob = outcome.turnout.participants.find((p) => p.participantId === 'bob');
    const carol = outcome.turnout.participants.find((p) => p.participantId === 'carol');
    expect(bob).toEqual({ participantId: 'bob', displayName: 'Bob', sent: false });
    expect(carol).toEqual({ participantId: 'carol', displayName: 'Carol', sent: false });
  });

  /*
   * A field added here later reaches a participant's screen without anyone
   * deciding it should, so the shape itself is pinned: three keys per person,
   * three at the top, and nothing else. This test is meant to fail when the
   * answer grows — that is a decision to be made, not a diff to wave through.
   */
  it('carries nothing about a participant beyond whether their vote is in', async () => {
    const outcome = await new GetTurnout(await roomOfThree()).execute('contest-1');

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(Object.keys(outcome.turnout).sort()).toEqual([
      'participants',
      'votesExpected',
      'votesIn',
    ]);
    for (const participant of outcome.turnout.participants) {
      expect(Object.keys(participant).sort()).toEqual(['displayName', 'participantId', 'sent']);
    }
  });

  it('counts nobody as in when no vote has been sent', async () => {
    const contests = new FakeContestRepository();
    await contests.insert(liveContest());
    const roster = new FakeRosterRepository();
    await roster.seed('contest-1', [{ participantId: 'ana', displayName: 'Ana' }]);

    const outcome = await new GetTurnout({
      contests,
      roster,
      voteSessions: new FakeVoteSessionRepository(),
    }).execute('contest-1');

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.turnout.votesIn).toBe(0);
    expect(outcome.turnout.votesExpected).toBe(1);
  });

  it('reports CONTEST_NOT_FOUND for an unknown contest', async () => {
    const outcome = await new GetTurnout({
      contests: new FakeContestRepository(),
      roster: new FakeRosterRepository(),
      voteSessions: new FakeVoteSessionRepository(),
    }).execute('unknown');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('CONTEST_NOT_FOUND');
  });
});
