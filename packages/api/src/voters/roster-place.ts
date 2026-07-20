/** A place in a contest's roster — a participant the host listed, claimed or still open. */
export interface RosterPlace {
  readonly contestId: string;
  readonly participantId: string;
  readonly displayName: string;
  readonly claimedAt: string | null;
}
