/** A participant who has joined a contest — no account, scoped to that one contest. */
export interface StoredVoter {
  readonly id: string;
  readonly contestId: string;
  readonly displayName: string;
  readonly createdAt: string;
}
