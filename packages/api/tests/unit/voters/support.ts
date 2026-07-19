import type { StoredVoter, VoterRepository } from '../../../src/index.js';

export class FakeVoterRepository implements VoterRepository {
  private readonly store = new Map<string, StoredVoter>();
  insert(voter: StoredVoter): void {
    this.store.set(voter.id, voter);
  }
  findById(id: string): StoredVoter | undefined {
    return this.store.get(id);
  }
}
