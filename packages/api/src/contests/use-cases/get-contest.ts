import type { ContestRepository } from '../../db/contest-repository.js';
import type { StoredContest } from '../stored-contest.js';

/** Reads a contest's public state (query). */
export class GetContest {
  constructor(private readonly contests: ContestRepository) {}

  async execute(contestId: string): Promise<StoredContest | undefined> {
    return await this.contests.findById(contestId);
  }
}
