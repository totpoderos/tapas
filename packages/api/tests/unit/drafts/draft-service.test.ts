import type { AuditEntry, DraftContent, StoredDraft } from '@tapas/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AuditRecorder,
  createAuditProjection,
  DraftService,
  type AuditLogRepository,
  type DraftRepository,
} from '../../../src/index.js';

class FakeDraftRepository implements DraftRepository {
  private store = new Map<string, StoredDraft>();
  insert(d: StoredDraft): void {
    this.store.set(d.id, d);
  }
  update(d: StoredDraft): void {
    this.store.set(d.id, d);
  }
  findById(id: string): StoredDraft | undefined {
    return this.store.get(id);
  }
  findByHost(hostId: string): StoredDraft[] {
    return [...this.store.values()].filter((d) => d.hostId === hostId);
  }
  delete(id: string): void {
    this.store.delete(id);
  }
}

class FakeAuditLog implements AuditLogRepository {
  entries: AuditEntry[] = [];
  append(e: AuditEntry): void {
    this.entries.push(e);
  }
  findByContest(contestId: string): AuditEntry[] {
    return this.entries.filter((e) => e.contestId === contestId);
  }
}

function content(name: string): DraftContent {
  return { name, participants: [] };
}

function makeService() {
  const drafts = new FakeDraftRepository();
  const auditLog = new FakeAuditLog();
  let n = 0;
  const ids = { next: () => `id-${++n}` };
  const clock = { now: () => '2026-07-19T10:00:00.000Z' };
  const audit = new AuditRecorder(auditLog, createAuditProjection({ clock, ids }));
  const service = new DraftService({ drafts, audit, clock, ids });
  return { service, drafts, auditLog };
}

describe('DraftService', () => {
  let env: ReturnType<typeof makeService>;
  beforeEach(() => {
    env = makeService();
  });

  it('saves a draft and emits draft.saved', () => {
    const r = env.service.save('host-1', content('Summer'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(env.service.get(r.draft.id, 'host-1')).toBeDefined();
    const saved = env.auditLog.findByContest(r.draft.id).find((e) => e.type === 'draft.saved');
    expect(saved?.actorId).toBe('host-1');
    expect(saved?.sourcePath).toBe('form');
    expect((saved?.after as DraftContent).name).toBe('Summer');
  });

  it('rejects a nameless draft and stores nothing', () => {
    const r = env.service.save('host-1', content('  '));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NAME_REQUIRED');
    expect(env.service.list('host-1')).toHaveLength(0);
    expect(env.auditLog.entries).toHaveLength(0);
  });

  it('tags the audit entry with the given source path', () => {
    const r = env.service.save('host-1', content('Via chat'), 'mcp');
    if (!r.ok) throw new Error('expected ok');
    expect(env.auditLog.findByContest(r.draft.id)[0]?.sourcePath).toBe('mcp');
  });

  it('renames a draft and records before/after', () => {
    const saved = env.service.save('host-1', content('Old'));
    if (!saved.ok) throw new Error('expected ok');
    const r = env.service.rename(saved.draft.id, 'host-1', 'New');
    expect(r.ok).toBe(true);

    const updated = env.auditLog.findByContest(saved.draft.id).find((e) => e.type === 'draft.updated');
    expect((updated?.before as DraftContent).name).toBe('Old');
    expect((updated?.after as DraftContent).name).toBe('New');
  });

  it('rejects renaming to an empty name', () => {
    const saved = env.service.save('host-1', content('Old'));
    if (!saved.ok) throw new Error('expected ok');
    const r = env.service.rename(saved.draft.id, 'host-1', '   ');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NAME_REQUIRED');
  });

  it('discards a draft and emits draft.discarded', () => {
    const saved = env.service.save('host-1', content('Old'));
    if (!saved.ok) throw new Error('expected ok');
    expect(env.service.discard(saved.draft.id, 'host-1').ok).toBe(true);
    expect(env.service.list('host-1')).toHaveLength(0);
    expect(env.auditLog.findByContest(saved.draft.id).some((e) => e.type === 'draft.discarded')).toBe(true);
  });

  describe('ownership (OWASP A01)', () => {
    it('hides another host’s draft from get', () => {
      const saved = env.service.save('host-1', content('Mine'));
      if (!saved.ok) throw new Error('expected ok');
      expect(env.service.get(saved.draft.id, 'host-2')).toBeUndefined();
    });

    it('refuses to rename another host’s draft', () => {
      const saved = env.service.save('host-1', content('Mine'));
      if (!saved.ok) throw new Error('expected ok');
      const r = env.service.rename(saved.draft.id, 'host-2', 'Hijacked');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('DRAFT_NOT_FOUND');
    });

    it('refuses to discard another host’s draft', () => {
      const saved = env.service.save('host-1', content('Mine'));
      if (!saved.ok) throw new Error('expected ok');
      const r = env.service.discard(saved.draft.id, 'host-2');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('DRAFT_NOT_FOUND');
    });

    it('lists only the requesting host’s drafts', () => {
      env.service.save('host-1', content('A'));
      env.service.save('host-2', content('B'));
      expect(env.service.list('host-1').map((d) => d.content.name)).toEqual(['A']);
    });
  });

  it('reports DRAFT_NOT_FOUND for an unknown draft', () => {
    const r = env.service.rename('nope', 'host-1', 'X');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('DRAFT_NOT_FOUND');
  });
});
