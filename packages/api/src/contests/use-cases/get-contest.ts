import type { ContestRepository } from '../../db/contest-repository.js';
import type { StoredContest } from '../stored-contest.js';

/** Reads a contest's public state (query). */
export class GetContest {
  constructor(private readonly contests: ContestRepository) {}

  execute(contestId: string): StoredContest | undefined {
    return this.contests.findById(contestId);
  }
}
