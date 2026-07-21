import type { VoteSessionRepository } from '../../db/vote-session-repository.js';
import type { StoredScore } from '../stored-vote-session.js';

export interface GetMyScoresDeps {
  readonly voteSessions: VoteSessionRepository;
}

/** Reads a voter's own scores in a contest (query). */
export class GetMyScores {
  constructor(private readonly deps: GetMyScoresDeps) {}

  execute(contestId: string, voterId: string): StoredScore[] {
    const session = this.deps.voteSessions.findSession(contestId, voterId);
    if (!session) return [];
    return this.deps.voteSessions.listScores(session.id);
  }
}
