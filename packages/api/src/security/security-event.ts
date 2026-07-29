/** A recorded authentication/security event (design.md §11B.7). Never carries a password or full token. */
export interface SecurityEvent {
  readonly id: string;
  readonly type: SecurityEventType;
  readonly actorId: string | null;
  readonly sourceIp: string;
  readonly reason: string | null;
  readonly occurredAt: string;
}

export type SecurityEventType =
  | 'sign_in.succeeded'
  | 'sign_in.refused'
  | 'pat.issued'
  | 'pat.used'
  /** Someone signed in reached for administrative work without the authority for it. */
  | 'admin_access.refused'
  /** An invitation's life: issued by an administrator, accepted, or refused for an unusable link. */
  | 'invitation.issued'
  | 'invitation.accepted'
  | 'invitation.refused'
  /** Endings an administrator caused: taken back, or replaced by a fresh invitation. */
  | 'invitation.revoked'
  | 'invitation.resent'
  /** A deployment being claimed, claimed successfully, or somebody trying to claim one that is not theirs. */
  | 'admin_bootstrap.claimed'
  | 'admin_bootstrap.completed'
  | 'admin_bootstrap.refused';

/** What a caller supplies; the log stamps the id and timestamp. */
export interface SecurityEventInput {
  readonly type: SecurityEventType;
  readonly actorId: string | null;
  readonly sourceIp: string;
  readonly reason?: string | null;
}

export interface SecurityEventLog {
  record(event: SecurityEventInput): void;
  list(): SecurityEvent[];
}
