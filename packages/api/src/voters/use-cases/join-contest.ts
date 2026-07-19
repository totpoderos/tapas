import type { Clock, IdGenerator } from '../../audit/audit-projection.js';
import type { ContestRepository } from '../../db/contest-repository.js';
import type { VoterRepository } from '../../db/voter-repository.js';
import type { TokenIssuer } from '../../auth/token-issuer.js';
import type { JoinResult } from './shared.js';

export interface JoinContestDeps {
  readonly contests: ContestRepository;
  readonly voters: VoterRepository;
  readonly tokens: TokenIssuer;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

/** Joins a participant to a live contest by its join code — no account, no password. */
export class JoinContest {
  constructor(private readonly deps: JoinContestDeps) {}

  execute(joinCode: string, displayName: string): JoinResult {
    const contest = this.deps.contests.findByJoinCode(joinCode);
    if (!contest) return { ok: false, error: { code: 'JOIN_CODE_NOT_FOUND', message: 'No such join code.' } };

    const voter = {
      id: this.deps.ids.next(),
      contestId: contest.id,
      displayName,
      createdAt: this.deps.clock.now(),
    };
    this.deps.voters.insert(voter);

    const session = this.deps.tokens.issue({ sub: voter.id, role: 'voter', contestId: contest.id });
    return { ok: true, session, voterId: voter.id, contestId: contest.id };
  }
}
