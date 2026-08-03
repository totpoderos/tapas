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
  async insert(draft: StoredDraft): Promise<void> {
    this.store.set(draft.id, draft);
  }
  async update(draft: StoredDraft): Promise<void> {
    this.store.set(draft.id, draft);
  }
  async findById(id: string): Promise<StoredDraft | undefined> {
    return this.store.get(id);
  }
  async findByHost(hostId: string): Promise<StoredDraft[]> {
    return [...this.store.values()].filter((draft) => draft.hostId === hostId);
  }
  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

export class FakeAuditLog implements AuditLogRepository {
  readonly entries: AuditEntry[] = [];
  async append(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }
  async findByContest(contestId: string): Promise<AuditEntry[]> {
    return this.entries.filter((entry) => entry.contestId === contestId);
  }
  async deleteByContest(contestId: string): Promise<void> {
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
