import type { RosterPlace, RosterRepository, RosterSeed } from '../../../src/index.js';

export class FakeRosterRepository implements RosterRepository {
  private readonly places = new Map<string, RosterPlace>();
  private key(contestId: string, participantId: string): string {
    return `${contestId}:${participantId}`;
  }
  seed(contestId: string, places: readonly RosterSeed[]): void {
    for (const place of places) {
      this.places.set(this.key(contestId, place.participantId), {
        contestId,
        participantId: place.participantId,
        displayName: place.displayName,
        claimedAt: null,
      });
    }
  }
  listAvailable(contestId: string): RosterPlace[] {
    return [...this.places.values()].filter(
      (p) => p.contestId === contestId && p.claimedAt === null,
    );
  }
  find(contestId: string, participantId: string): RosterPlace | undefined {
    return this.places.get(this.key(contestId, participantId));
  }
  claim(contestId: string, participantId: string, claimedAt: string): boolean {
    const place = this.places.get(this.key(contestId, participantId));
    if (!place || place.claimedAt !== null) return false;
    this.places.set(this.key(contestId, participantId), { ...place, claimedAt });
    return true;
  }
}
