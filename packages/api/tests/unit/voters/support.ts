import type { RosterPlace, RosterRepository, RosterSeed } from '../../../src/index.js';

export class FakeRosterRepository implements RosterRepository {
  private readonly places = new Map<string, RosterPlace>();
  private key(contestId: string, participantId: string): string {
    return `${contestId}:${participantId}`;
  }
  async seed(contestId: string, places: readonly RosterSeed[]): Promise<void> {
    for (const place of places) {
      this.places.set(this.key(contestId, place.participantId), {
        contestId,
        participantId: place.participantId,
        displayName: place.displayName,
        claimedAt: null,
      });
    }
  }
  async listAvailable(contestId: string): Promise<RosterPlace[]> {
    return [...this.places.values()].filter(
      (p) => p.contestId === contestId && p.claimedAt === null,
    );
  }
  async listClaimed(contestId: string): Promise<RosterPlace[]> {
    return [...this.places.values()].filter(
      (p) => p.contestId === contestId && p.claimedAt !== null,
    );
  }
  async listAll(contestId: string): Promise<RosterPlace[]> {
    return [...this.places.values()].filter((p) => p.contestId === contestId);
  }
  async countClaimedByContest(contestIds: readonly string[]): Promise<Map<string, number>> {
    const wanted = new Set(contestIds);
    const counts = new Map<string, number>();
    for (const place of this.places.values()) {
      if (!wanted.has(place.contestId) || place.claimedAt === null) continue;
      counts.set(place.contestId, ((counts.get(place.contestId)) ?? 0) + 1);
    }
    // Absent rather than zero, matching the real one: the caller decides what
    // "no rows" means for the contest it asked about.
    return counts;
  }
  async find(contestId: string, participantId: string): Promise<RosterPlace | undefined> {
    return this.places.get(this.key(contestId, participantId));
  }
  async claim(contestId: string, participantId: string, claimedAt: string): Promise<boolean> {
    const place = this.places.get(this.key(contestId, participantId));
    if (!place || place.claimedAt !== null) return false;
    this.places.set(this.key(contestId, participantId), { ...place, claimedAt });
    return true;
  }
  async deleteByContest(contestId: string): Promise<void> {
    for (const [key, place] of this.places) {
      if (place.contestId === contestId) this.places.delete(key);
    }
  }
}
