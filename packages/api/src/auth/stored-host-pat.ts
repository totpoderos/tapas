/** A host's personal access token — only the hash is kept; the raw token is shown once, at issuance. */
export interface StoredHostPat {
  readonly id: string;
  readonly hostId: string;
  readonly tokenHash: string;
  readonly createdAt: string;
  readonly revokedAt: string | null;
}
