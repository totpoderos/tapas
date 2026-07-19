import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import type { DraftContent } from '@tapas/shared';
import { expect } from 'vitest';
import {
  AuditRecorder,
  createAuditProjection,
  DraftService,
  runMigrations,
  SqliteAuditLogRepository,
  SqliteDraftRepository,
  type Clock,
  type IdGenerator,
} from '../../src/index.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./managing-a-contest-draft.feature', import.meta.url)),
);

function makeEnv() {
  const db = new DatabaseSync(':memory:');
  runMigrations(db);
  const drafts = new SqliteDraftRepository(db);
  const auditRepo = new SqliteAuditLogRepository(db);
  let n = 0;
  const ids: IdGenerator = { next: () => `id-${++n}` };
  const clock: Clock = { now: () => '2026-07-19T10:00:00.000Z' };
  const audit = new AuditRecorder(auditRepo, createAuditProjection({ clock, ids }));
  const service = new DraftService({ drafts, audit, clock, ids });
  return { service, auditRepo };
}

function draftContent(name: string): DraftContent {
  return {
    name,
    attribution: 'per_person',
    antiBias: 'couples',
    scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'auto' }, uniquePerCategory: true },
    participants: [],
  };
}

type Env = ReturnType<typeof makeEnv>;

describeFeature(feature, ({ Scenario }) => {
  Scenario('A host saves a new draft', ({ Given, When, Then, And }) => {
    let env: Env;
    const hostId = 'host-1';
    let draftId = '';

    Given('a host', () => void (env = makeEnv()));
    When('the host saves a draft named "Summer Tapas 2026" scored per person with couples barred', () => {
      const r = env.service.save(hostId, draftContent('Summer Tapas 2026'));
      expect(r.ok).toBe(true);
      if (r.ok) draftId = r.draft.id;
    });
    Then('the draft is stored', () => {
      expect(env.service.get(draftId, hostId)).toBeDefined();
    });
    And("the draft appears among the host's drafts", () => {
      expect(env.service.list(hostId).map((d) => d.content.name)).toContain('Summer Tapas 2026');
    });
    And('the audit log records that the draft was saved by that host', () => {
      const entries = env.auditRepo.findByContest(draftId);
      const saved = entries.find((e) => e.type === 'draft.saved');
      expect(saved).toBeDefined();
      expect(saved?.actorId).toBe(hostId);
      expect(saved?.sourcePath).toBe('form');
    });
  });

  Scenario('A host edits a draft', ({ Given, When, Then, And }) => {
    let env: Env;
    const hostId = 'host-1';
    let draftId = '';

    Given('a host with a saved draft named "Summer Tapas 2026"', () => {
      env = makeEnv();
      const r = env.service.save(hostId, draftContent('Summer Tapas 2026'));
      if (r.ok) draftId = r.draft.id;
    });
    When('the host renames the draft to "Summer Tapas Final"', () => {
      const r = env.service.rename(draftId, hostId, 'Summer Tapas Final');
      expect(r.ok).toBe(true);
    });
    Then('the stored draft is named "Summer Tapas Final"', () => {
      expect(env.service.get(draftId, hostId)?.content.name).toBe('Summer Tapas Final');
    });
    And('the audit log records the change with the previous and the new name', () => {
      const updated = env.auditRepo.findByContest(draftId).find((e) => e.type === 'draft.updated');
      expect((updated?.before as DraftContent | undefined)?.name).toBe('Summer Tapas 2026');
      expect((updated?.after as DraftContent | undefined)?.name).toBe('Summer Tapas Final');
    });
  });

  Scenario('A host discards a draft', ({ Given, When, Then, And }) => {
    let env: Env;
    const hostId = 'host-1';
    let draftId = '';

    Given('a host with a saved draft named "Summer Tapas 2026"', () => {
      env = makeEnv();
      const r = env.service.save(hostId, draftContent('Summer Tapas 2026'));
      if (r.ok) draftId = r.draft.id;
    });
    When('the host discards the draft', () => {
      expect(env.service.discard(draftId, hostId).ok).toBe(true);
    });
    Then("the draft no longer appears among the host's drafts", () => {
      expect(env.service.list(hostId)).toHaveLength(0);
    });
    And('the audit log records that the draft was discarded', () => {
      expect(env.auditRepo.findByContest(draftId).some((e) => e.type === 'draft.discarded')).toBe(true);
    });
  });

  Scenario('A draft without a name cannot be saved', ({ Given, When, Then }) => {
    let env: Env;
    const hostId = 'host-1';
    let result: ReturnType<DraftService['save']>;

    Given('a host', () => void (env = makeEnv()));
    When('the host tries to save a draft with no name', () => {
      result = env.service.save(hostId, draftContent(''));
    });
    Then('saving is rejected because a name is required', () => {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('NAME_REQUIRED');
    });
  });

  Scenario('A host only sees their own drafts', ({ Given, When, Then, And }) => {
    let env: Env;
    let names: string[] = [];

    Given('a host with a saved draft named "Summer Tapas 2026"', () => {
      env = makeEnv();
      env.service.save('host-1', draftContent('Summer Tapas 2026'));
    });
    And('another host with a saved draft named "Winter Tapas"', () => {
      env.service.save('host-2', draftContent('Winter Tapas'));
    });
    When('the host lists their drafts', () => {
      names = env.service.list('host-1').map((d) => d.content.name);
    });
    Then('only "Summer Tapas 2026" appears', () => {
      expect(names).toEqual(['Summer Tapas 2026']);
    });
  });
});
