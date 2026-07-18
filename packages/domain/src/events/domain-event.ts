/**
 * A domain event, emitted by an aggregate on every state change.
 *
 * The audit log is a *projection* of these events (design.md §5): the pure
 * domain emits the event; the application layer enriches it with request-path
 * metadata (sourcePath, toolName, …) when projecting it into an AuditEntry.
 *
 * The domain is pure, so it does not know the wall-clock or generate ids —
 * `occurredAt` (and any id) is supplied by the boundary when the event is
 * recorded.
 */
export interface DomainEvent<TType extends string = string, TPayload = unknown> {
  /** Dotted event name, e.g. "draft.saved", "vote.sent", "contest.revealed". */
  readonly type: TType;
  /** The contest this event belongs to. */
  readonly contestId: string;
  /** Who caused it: a host/voter id, or "system". */
  readonly actorId: string;
  /** Aggregate state before the change, when meaningful. */
  readonly before?: TPayload;
  /** Aggregate state after the change, when meaningful. */
  readonly after?: TPayload;
}

/** The distinguished actor for events triggered by the system itself. */
export const SYSTEM_ACTOR = 'system' as const;
