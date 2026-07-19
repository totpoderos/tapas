import type { MaterializedContest } from '@tapas/domain';
import { describe, expect, it } from 'vitest';
import { HmacJwtTokenIssuer, JoinContest, type Clock } from '../../../../src/index.js';
import { FakeContestRepository } from '../../contests/support.js';
import { FakeVoterRepository } from '../support.js';

const EMPTY_MATERIALIZED: MaterializedContest = {
  dishes: [],
  allowedVoters: new Map(),
  scoreRangeByVoter: new Map(),
  uniquePerCategory: false,
  categories: [],
};

const clock: Clock = { now: () => '2026-07-19T10:00:00.000Z' };
const SECRET = 'a-test-secret-that-is-32-plus-characters';

function makeJoinEnv() {
  const contests = new FakeContestRepository();
  const voters = new FakeVoterRepository();
  const tokens = new HmacJwtTokenIssuer(SECRET, clock);
  let sequence = 0;
  const ids = { next: () => `voter-${++sequence}` };
  return { joinContest: new JoinContest({ contests, voters, tokens, ids, clock }), contests, voters, tokens };
}

function liveContest(id: string, joinCode: string) {
  return {
    id,
    hostId: 'host-1',
    name: 'Tapas Night',
    joinCode,
    status: 'live' as const,
    materialized: EMPTY_MATERIALIZED,
    createdAt: '2026-07-18T10:00:00.000Z',
  };
}

describe('JoinContest', () => {
  it('joins a participant to the live contest behind the code and issues a voter session', () => {
    const { joinContest, contests } = makeJoinEnv();
    contests.insert(liveContest('contest-1', 'TAPAS1'));

    const joinOutcome = joinContest.execute('TAPAS1', 'Marcos');

    expect(joinOutcome.ok).toBe(true);
    if (joinOutcome.ok) {
      expect(joinOutcome.contestId).toBe('contest-1');
      expect(joinOutcome.session.accessToken).toBeTruthy();
    }
  });

  it('records the joined voter under the contest', () => {
    const { joinContest, contests, voters } = makeJoinEnv();
    contests.insert(liveContest('contest-1', 'TAPAS1'));

    const joinOutcome = joinContest.execute('TAPAS1', 'Marcos');

    expect(joinOutcome.ok).toBe(true);
    if (joinOutcome.ok) {
      const voter = voters.findById(joinOutcome.voterId);
      expect(voter?.displayName).toBe('Marcos');
      expect(voter?.contestId).toBe('contest-1');
    }
  });

  it('refuses an unknown join code', () => {
    const { joinContest } = makeJoinEnv();

    const joinOutcome = joinContest.execute('GHOST1', 'Marcos');

    expect(joinOutcome.ok).toBe(false);
    if (!joinOutcome.ok) expect(joinOutcome.error.code).toBe('JOIN_CODE_NOT_FOUND');
  });

  it('scopes the issued token to the joined contest', () => {
    const { joinContest, contests, tokens } = makeJoinEnv();
    contests.insert(liveContest('contest-1', 'TAPAS1'));

    const joinOutcome = joinContest.execute('TAPAS1', 'Marcos');

    expect(joinOutcome.ok).toBe(true);
    if (joinOutcome.ok) {
      const claims = tokens.verify(joinOutcome.session.accessToken);
      expect(claims?.role).toBe('voter');
      expect(claims?.contestId).toBe('contest-1');
    }
  });
});
