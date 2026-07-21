/** A voter's vote session in a contest — the container for their scores, draft until sent. */
export interface StoredVoteSession {
  readonly id: string;
  readonly contestId: string;
  readonly voterId: string;
  readonly status: 'draft' | 'sent';
  readonly createdAt: string;
  readonly submittedAt: string | null;
}

/** A single score within a vote session, for one dish in one category. */
export interface StoredScore {
  readonly id: string;
  readonly voteSessionId: string;
  readonly dishId: string;
  readonly categoryId: string;
  readonly value: number;
}
