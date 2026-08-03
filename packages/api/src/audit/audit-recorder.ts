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

  async record(event: DomainEvent, context: AuditContext): Promise<AuditEntry> {
    const entry = this.projection.project(event, context);
    await this.repo.append(entry);
    return entry;
  }

  /**
   * Erases a contest's recorded history. The **only** caller is `DeleteContest`,
   * which writes a `contest.deleted` tombstone immediately afterwards.
   *
   * This is the single exception to the log being append-only, and it goes
   * through the recorder rather than around it so the log keeps exactly one door.
   * It exists because the log stores participant names inside recorded draft
   * content, so a delete that spared the log would not delete anyone's data —
   * see `DeleteContest` for the full reasoning.
   */
  async deleteByContest(contestId: string): Promise<void> {
    await this.repo.deleteByContest(contestId);
  }
}
