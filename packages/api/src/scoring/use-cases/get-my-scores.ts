import type { VoteSessionRepository } from '../../db/vote-session-repository.js';
import type { StoredScore, StoredVoteSession } from '../stored-vote-session.js';

export interface GetMyScoresDeps {
  readonly voteSessions: VoteSessionRepository;
}

/** A voter's own scores, and whether the vote holding them is a draft or sent. */
export interface MyScores {
  readonly scores: readonly StoredScore[];
  readonly status: StoredVoteSession['status'];
}

/**
 * Reads a voter's own scores in a contest, and the state of the vote holding
 * them (query).
 *
 * The status is the point: without it the participant app cannot tell a sent
 * vote from a draft, so it kept that in the screen's memory — which a reload or
 * a step back wiped, leaving someone who had already voted looking at an
 * editable ballot with no way through to the results. The vote session has
 * recorded this all along; it simply was not passed on.
 *
 * A voter who has not started scoring has no session yet, which is a draft with
 * nothing in it rather than an absence.
 */
export class GetMyScores {
  constructor(private readonly deps: GetMyScoresDeps) {}

  execute(contestId: string, voterId: string): MyScores {
    const session = this.deps.voteSessions.findSession(contestId, voterId);
    if (!session) return { scores: [], status: 'draft' };
    return { scores: this.deps.voteSessions.listScores(session.id), status: session.status };
  }
}
