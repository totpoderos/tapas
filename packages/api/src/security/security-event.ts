/** A recorded authentication/security event (design.md §11B.7). Never carries a password or full token. */
export interface SecurityEvent {
  readonly id: string;
  readonly type: SecurityEventType;
  readonly actorId: string | null;
  readonly sourceIp: string;
  readonly reason: string | null;
  readonly occurredAt: string;
}

export type SecurityEventType = 'sign_in.succeeded' | 'sign_in.refused' | 'pat.issued' | 'pat.used';

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
