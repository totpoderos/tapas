import type { DomainEvent } from '@tapas/domain';
import type { AuditEntry } from '@tapas/shared';
import type { AuditContext, AuditProjection } from './audit-projection.js';
import type { AuditLogRepository } from '../db/audit-repository.js';

/**
 * Records a domain event to the audit log: projects it into an enriched
 * {@link AuditEntry} (attaching request-path metadata) and persists it. This is
 * the single write path for the audit log — there are no scattered `record()`
 * calls, so a gap is impossible by construction (design.md §5).
 */
export class AuditRecorder {
  constructor(
    private readonly repo: AuditLogRepository,
    private readonly projection: AuditProjection,
  ) {}

  record(event: DomainEvent, context: AuditContext): AuditEntry {
    const entry = this.projection.project(event, context);
    this.repo.append(entry);
    return entry;
  }
}
