import { tally } from '@tapas/domain';
import type { GetResultsDeps, GetResultsResult } from './shared.js';

/**
 * Reads a revealed contest's results, tallying every sent vote on demand —
 * scores can't change after a contest closes, so there is nothing to gain
 * from persisting a snapshot. Refuses until the contest has been revealed:
 * no peeking at winners early.
 */
export class GetResults {
  constructor(private readonly deps: GetResultsDeps) {}

  async execute(contestId: string): Promise<GetResultsResult> {
    const contest = await this.deps.contests.findById(contestId);
    if (!contest)
      return { ok: false, error: { code: 'CONTEST_NOT_FOUND', message: 'No such contest.' } };
    if (contest.status !== 'revealed') {
      return {
        ok: false,
        error: { code: 'NOT_REVEALED', message: 'This contest has not been revealed yet.' },
      };
    }

    const entries = await this.deps.voteSessions.listSentScores(contestId);
    return { ok: true, results: tally(contest.materialized, entries) };
  }
}
