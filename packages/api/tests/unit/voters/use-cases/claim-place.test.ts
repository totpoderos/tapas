import type { MaterializedContest } from '@tapas/domain';
import { describe, expect, it } from 'vitest';
import { ClaimPlace, HmacJwtTokenIssuer, type Clock } from '../../../../src/index.js';
import { FakeContestRepository } from '../../contests/support.js';
import { FakeRosterRepository } from '../support.js';

const clock: Clock = { now: () => '2026-07-20T10:00:00.000Z' };
const SECRET = 'a-test-secret-that-is-32-plus-characters';

const EMPTY_MATERIALIZED: MaterializedContest = {
  dishes: [],
  allowedVoters: new Map(),
  scoreRangeByVoter: new Map(),
  uniquePerCategory: false,
  categories: [],
};

function makeClaimEnv() {
  const contests = new FakeContestRepository();
  const roster = new FakeRosterRepository();
  const tokens = new HmacJwtTokenIssuer(SECRET, clock);
  return {
    claimPlace: new ClaimPlace({ contests, roster, tokens, clock }),
    contests,
    roster,
    tokens,
  };
}

function liveContest(id: string, joinCode: string) {
  return {
    id,
    hostId: 'host-1',
    name: 'Tapas Night',
    joinCode,
    status: 'live' as const,
    materialized: EMPTY_MATERIALIZED,
    createdAt: '2026-07-19T10:00:00.000Z',
  };
}

describe('ClaimPlace', () => {
  it('claims an open place and issues a voter token carrying the participant id', () => {
    const { claimPlace, contests, roster, tokens } = makeClaimEnv();
    contests.insert(liveContest('contest-1', 'TAPAS1'));
    roster.seed('contest-1', [{ participantId: 'ana', displayName: 'Ana' }]);

    const outcome = claimPlace.execute('TAPAS1', 'ana');

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.displayName).toBe('Ana');
      const claims = tokens.verify(outcome.session.accessToken);
      expect(claims?.role).toBe('voter');
      expect(claims?.sub).toBe('ana');
      expect(claims?.contestId).toBe('contest-1');
    }
    expect(roster.find('contest-1', 'ana')?.claimedAt).toBeTruthy();
  });

  it('refuses an unknown join code', () => {
    const { claimPlace } = makeClaimEnv();
    const outcome = claimPlace.execute('GHOST1', 'ana');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('JOIN_CODE_NOT_FOUND');
  });

  it('refuses a place that is not on the roster', () => {
    const { claimPlace, contests } = makeClaimEnv();
    contests.insert(liveContest('contest-1', 'TAPAS1'));

    const outcome = claimPlace.execute('TAPAS1', 'zoe');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('NO_SUCH_PLACE');
  });

  it('refuses a place that is already taken', () => {
    const { claimPlace, contests, roster } = makeClaimEnv();
    contests.insert(liveContest('contest-1', 'TAPAS1'));
    roster.seed('contest-1', [{ participantId: 'ana', displayName: 'Ana' }]);
    claimPlace.execute('TAPAS1', 'ana');

    const second = claimPlace.execute('TAPAS1', 'ana');

    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe('PLACE_TAKEN');
  });
});
