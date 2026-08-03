import type {
  SessionCounts,
  StoredScore,
  StoredVoteSession,
  VoteSessionRepository,
} from '../../../src/index.js';

export class FakeVoteSessionRepository implements VoteSessionRepository {
  private readonly sessions = new Map<string, StoredVoteSession>();
  private readonly scores = new Map<string, StoredScore>();

  private sessionKey(contestId: string, voterId: string): string {
    return `${contestId}:${voterId}`;
  }
  private scoreKey(voteSessionId: string, dishId: string, categoryId: string): string {
    return `${voteSessionId}:${dishId}:${categoryId}`;
  }

  async findSession(contestId: string, voterId: string): Promise<StoredVoteSession | undefined> {
    return this.sessions.get(this.sessionKey(contestId, voterId));
  }
  async createSession(session: StoredVoteSession): Promise<void> {
    this.sessions.set(this.sessionKey(session.contestId, session.voterId), session);
  }
  async markSent(voteSessionId: string, submittedAt: string): Promise<void> {
    for (const [key, session] of this.sessions.entries()) {
      if (session.id === voteSessionId) {
        this.sessions.set(key, { ...session, status: 'sent', submittedAt });
      }
    }
  }
  async findScore(voteSessionId: string, dishId: string, categoryId: string): Promise<StoredScore | undefined> {
    return this.scores.get(this.scoreKey(voteSessionId, dishId, categoryId));
  }
  async upsertScore(score: StoredScore): Promise<void> {
    this.scores.set(this.scoreKey(score.voteSessionId, score.dishId, score.categoryId), score);
  }
  async listScores(voteSessionId: string): Promise<StoredScore[]> {
    return [...this.scores.values()].filter((score) => score.voteSessionId === voteSessionId);
  }
  async listSentScores(contestId: string): Promise<StoredScore[]> {
    const sentSessionIds = new Set(
      [...this.sessions.values()]
        .filter((session) => session.contestId === contestId && session.status === 'sent')
        .map((session) => session.id),
    );
    return [...this.scores.values()].filter((score) => sentSessionIds.has(score.voteSessionId));
  }
  async listSessions(contestId: string): Promise<StoredVoteSession[]> {
    return [...this.sessions.values()].filter((session) => session.contestId === contestId);
  }
  async countSessionsByContest(contestIds: readonly string[]): Promise<Map<string, SessionCounts>> {
    const wanted = new Set(contestIds);
    const counts = new Map<string, SessionCounts>();
    for (const session of this.sessions.values()) {
      if (!wanted.has(session.contestId)) continue;
      const soFar = (counts.get(session.contestId)) ?? { draftCount: 0, sentCount: 0 };
      counts.set(session.contestId, {
        draftCount: soFar.draftCount + (session.status === 'draft' ? 1 : 0),
        sentCount: soFar.sentCount + (session.status === 'sent' ? 1 : 0),
      });
    }
    // Absent rather than zero, matching the real one.
    return counts;
  }
  async deleteByContest(contestId: string): Promise<void> {
    const doomed = new Set<string>();
    for (const [key, session] of this.sessions) {
      if (session.contestId !== contestId) continue;
      doomed.add(session.id);
      this.sessions.delete(key);
    }
    // Scores are keyed by session, so they go with the sessions they belonged to.
    for (const [key, score] of this.scores) {
      if (doomed.has(score.voteSessionId)) this.scores.delete(key);
    }
  }
}
