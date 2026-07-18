import type { DomainEvent } from '@tapas/domain';

/** How an action was triggered. The security-relevant provenance field. */
export type SourcePath = 'form' | 'mcp' | 'system';

/**
 * An audit entry is a *projection* of a {@link DomainEvent}, enriched with
 * request-path metadata the pure domain does not know (design.md §5). The
 * application layer attaches these fields when it records the event.
 */
export interface AuditEntry extends DomainEvent {
  readonly id: string;
  readonly sourcePath: SourcePath;
  /** Present when sourcePath === 'mcp'. */
  readonly toolName?: string;
  /** Present when sourcePath === 'mcp'. */
  readonly toolArgs?: unknown;
  /** Present on destructive actions: was it host-confirmed or auto? */
  readonly confirmation?: 'host' | 'auto';
  /** ISO-8601 timestamp, assigned at the boundary. */
  readonly occurredAt: string;
}
