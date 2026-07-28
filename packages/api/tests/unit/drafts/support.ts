import type { DraftContent } from '@tapas/domain';
import type { AuditEntry } from '@tapas/shared';
import {
  AuditRecorder,
  createAuditProjection,
  type AuditLogRepository,
  type DraftRepository,
  type StoredDraft,
} from '../../../src/index.js';

export class FakeDraftRepository implements DraftRepository {
  private readonly store = new Map<string, StoredDraft>();
  insert(draft: StoredDraft): void {
    this.store.set(draft.id, draft);
  }
  update(draft: StoredDraft): void {
    this.store.set(draft.id, draft);
  }
  findById(id: string): StoredDraft | undefined {
    return this.store.get(id);
  }
  findByHost(hostId: string): StoredDraft[] {
    return [...this.store.values()].filter((draft) => draft.hostId === hostId);
  }
  delete(id: string): void {
    this.store.delete(id);
  }
}

export class FakeAuditLog implements AuditLogRepository {
  readonly entries: AuditEntry[] = [];
  append(entry: AuditEntry): void {
    this.entries.push(entry);
  }
  findByContest(contestId: string): AuditEntry[] {
    return this.entries.filter((entry) => entry.contestId === contestId);
  }
  deleteByContest(contestId: string): void {
    for (let i = this.entries.length - 1; i >= 0; i -= 1) {
      if (this.entries[i]!.contestId === contestId) this.entries.splice(i, 1);
    }
  }
}

export function makeDraftDeps() {
  const drafts = new FakeDraftRepository();
  const auditLog = new FakeAuditLog();
  let sequence = 0;
  const ids = { next: () => `id-${++sequence}` };
  const clock = { now: () => '2026-07-19T10:00:00.000Z' };
  const audit = new AuditRecorder(auditLog, createAuditProjection({ clock, ids }));
  return { deps: { drafts, audit, clock, ids }, drafts, auditLog };
}

export function draftNamed(name: string): DraftContent {
  return { name, participants: [] };
}
