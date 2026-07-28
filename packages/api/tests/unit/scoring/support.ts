import type { StoredScore, StoredVoteSession, VoteSessionRepository } from '../../../src/index.js';

export class FakeVoteSessionRepository implements VoteSessionRepository {
  private readonly sessions = new Map<string, StoredVoteSession>();
  private readonly scores = new Map<string, StoredScore>();

  private sessionKey(contestId: string, voterId: string): string {
    return `${contestId}:${voterId}`;
  }
  private scoreKey(voteSessionId: string, dishId: string, categoryId: string): string {
    return `${voteSessionId}:${dishId}:${categoryId}`;
  }

  findSession(contestId: string, voterId: string): StoredVoteSession | undefined {
    return this.sessions.get(this.sessionKey(contestId, voterId));
  }
  createSession(session: StoredVoteSession): void {
    this.sessions.set(this.sessionKey(session.contestId, session.voterId), session);
  }
  markSent(voteSessionId: string, submittedAt: string): void {
    for (const [key, session] of this.sessions.entries()) {
      if (session.id === voteSessionId) {
        this.sessions.set(key, { ...session, status: 'sent', submittedAt });
      }
    }
  }
  findScore(voteSessionId: string, dishId: string, categoryId: string): StoredScore | undefined {
    return this.scores.get(this.scoreKey(voteSessionId, dishId, categoryId));
  }
  upsertScore(score: StoredScore): void {
    this.scores.set(this.scoreKey(score.voteSessionId, score.dishId, score.categoryId), score);
  }
  listScores(voteSessionId: string): StoredScore[] {
    return [...this.scores.values()].filter((score) => score.voteSessionId === voteSessionId);
  }
  listSentScores(contestId: string): StoredScore[] {
    const sentSessionIds = new Set(
      [...this.sessions.values()]
        .filter((session) => session.contestId === contestId && session.status === 'sent')
        .map((session) => session.id),
    );
    return [...this.scores.values()].filter((score) => sentSessionIds.has(score.voteSessionId));
  }
  listSessions(contestId: string): StoredVoteSession[] {
    return [...this.sessions.values()].filter((session) => session.contestId === contestId);
  }
  deleteByContest(contestId: string): void {
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
