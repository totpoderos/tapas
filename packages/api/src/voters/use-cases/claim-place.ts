import type { Clock } from '../../audit/audit-projection.js';
import type { ContestRepository } from '../../db/contest-repository.js';
import type { RosterRepository } from '../../db/roster-repository.js';
import type { TokenIssuer } from '../../auth/token-issuer.js';
import type { ClaimResult } from './shared.js';

export interface ClaimPlaceDeps {
  readonly contests: ContestRepository;
  readonly roster: RosterRepository;
  readonly tokens: TokenIssuer;
  readonly clock: Clock;
}

/**
 * Claims a place on a live contest's roster by its join code — no account, no
 * password. The issued token is scoped to the contest and carries the claimed
 * participant id, which is the identity the compiled constraint view uses.
 */
export class ClaimPlace {
  constructor(private readonly deps: ClaimPlaceDeps) {}

  async execute(joinCode: string, participantId: string): Promise<ClaimResult> {
    const contest = await this.deps.contests.findByJoinCode(joinCode);
    if (!contest)
      return { ok: false, error: { code: 'JOIN_CODE_NOT_FOUND', message: 'No such join code.' } };

    const place = await this.deps.roster.find(contest.id, participantId);
    if (!place)
      return {
        ok: false,
        error: { code: 'NO_SUCH_PLACE', message: 'No such place in this contest.' },
      };
    if (place.claimedAt)
      return { ok: false, error: { code: 'PLACE_TAKEN', message: 'That place is already taken.' } };

    const claimed = await this.deps.roster.claim(contest.id, participantId, this.deps.clock.now());
    if (!claimed)
      return { ok: false, error: { code: 'PLACE_TAKEN', message: 'That place is already taken.' } };

    const session = this.deps.tokens.issue({
      sub: participantId,
      role: 'voter',
      contestId: contest.id,
    });
    return {
      ok: true,
      session,
      contestId: contest.id,
      participantId,
      displayName: place.displayName,
    };
  }
}
