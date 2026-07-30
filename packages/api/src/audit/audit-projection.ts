import type { DomainEvent } from '@tapas/domain';
import type { AuditEntry, SourcePath } from '@tapas/shared';

/** Request-path metadata attached when projecting a domain event to the audit log. */
export interface AuditContext {
  readonly sourcePath: SourcePath;
  readonly toolName?: string;
  readonly toolArgs?: unknown;
  readonly confirmation?: 'host' | 'auto';
}

/**
 * How an action arrived, without saying whether anyone confirmed it.
 *
 * The two travel separately because they answer different questions and are
 * decided in different places: confirmation is a property of *this* request,
 * while provenance is carried across the assistant's dispatch. Use cases take
 * this and add their own confirmation handling on top.
 */
export type AuditProvenance = Pick<AuditContext, 'sourcePath' | 'toolName' | 'toolArgs'>;

/** Nobody said otherwise: a host working in the app directly. */
export const IN_APP: AuditProvenance = { sourcePath: 'form' };

/** Boundary dependencies the pure domain must not own. */
export interface Clock {
  now(): string;
}
export interface IdGenerator {
  next(): string;
}

/**
 * Projects a {@link DomainEvent} into an {@link AuditEntry}. This is the single
 * place request-path metadata is attached — there are no scattered
 * `record()` calls in the domain, so a gap in the audit log is impossible by
 * construction (design.md §5). Persistence is added in Phase 2.
 */
export interface AuditProjection {
  project(event: DomainEvent, context: AuditContext): AuditEntry;
}

export function createAuditProjection(deps: { clock: Clock; ids: IdGenerator }): AuditProjection {
  return {
    project(event, context) {
      return {
        id: deps.ids.next(),
        type: event.type,
        contestId: event.contestId,
        actorId: event.actorId,
        before: event.before,
        after: event.after,
        sourcePath: context.sourcePath,
        toolName: context.toolName,
        toolArgs: context.toolArgs,
        confirmation: context.confirmation,
        occurredAt: deps.clock.now(),
      };
    },
  };
}
