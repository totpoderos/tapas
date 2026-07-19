import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import type { DraftContent } from '@tapas/domain';
import { expect } from 'vitest';
import {
  AuditRecorder,
  CreateDraft,
  createAuditProjection,
  DiscardDraft,
  GetDraft,
  ListHostDrafts,
  RenameDraft,
  runMigrations,
  SqliteAuditLogRepository,
  SqliteDraftRepository,
  type Clock,
  type IdGenerator,
} from '../../src/index.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./managing-a-contest-draft.feature', import.meta.url)),
);

function makeDraftWorkspace() {
  const db = new DatabaseSync(':memory:');
  runMigrations(db);
  const drafts = new SqliteDraftRepository(db);
  const auditLog = new SqliteAuditLogRepository(db);
  let sequence = 0;
  const ids: IdGenerator = { next: () => `id-${++sequence}` };
  const clock: Clock = { now: () => '2026-07-19T10:00:00.000Z' };
  const audit = new AuditRecorder(auditLog, createAuditProjection({ clock, ids }));
  const deps = { drafts, audit, clock, ids };
  return {
    createDraft: new CreateDraft(deps),
    renameDraft: new RenameDraft(deps),
    discardDraft: new DiscardDraft(deps),
    getDraft: new GetDraft(drafts),
    listHostDrafts: new ListHostDrafts(drafts),
    auditLog,
  };
}

type DraftWorkspace = ReturnType<typeof makeDraftWorkspace>;

function draftNamed(name: string): DraftContent {
  return {
    name,
    attribution: 'per_person',
    antiBias: 'couples',
    scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'auto' }, uniquePerCategory: true },
    participants: [],
  };
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('A host saves a new draft', ({ Given, When, Then, And }) => {
    let workspace: DraftWorkspace;
    const hostId = 'host-1';
    let savedDraftId = '';

    Given('a host', () => void (workspace = makeDraftWorkspace()));
    When('the host saves a draft named "Summer Tapas 2026" scored per person with couples barred', () => {
      const creation = workspace.createDraft.execute(hostId, draftNamed('Summer Tapas 2026'));
      expect(creation.ok).toBe(true);
      if (creation.ok) savedDraftId = creation.draft.id;
    });
    Then('the draft is stored', () => {
      expect(workspace.getDraft.execute(savedDraftId, hostId)).toBeDefined();
    });
    And("the draft appears among the host's drafts", () => {
      const draftNames = workspace.listHostDrafts.execute(hostId).map((draft) => draft.content.name);
      expect(draftNames).toContain('Summer Tapas 2026');
    });
    And('the audit log records that the draft was saved by that host', () => {
      const savedEvent = workspace.auditLog.findByContest(savedDraftId).find((entry) => entry.type === 'draft.saved');
      expect(savedEvent?.actorId).toBe(hostId);
      expect(savedEvent?.sourcePath).toBe('form');
    });
  });

  Scenario('A host edits a draft', ({ Given, When, Then, And }) => {
    let workspace: DraftWorkspace;
    const hostId = 'host-1';
    let draftId = '';

    Given('a host with a saved draft named "Summer Tapas 2026"', () => {
      workspace = makeDraftWorkspace();
      const creation = workspace.createDraft.execute(hostId, draftNamed('Summer Tapas 2026'));
      if (creation.ok) draftId = creation.draft.id;
    });
    When('the host renames the draft to "Summer Tapas Final"', () => {
      const renameResult = workspace.renameDraft.execute(draftId, hostId, 'Summer Tapas Final');
      expect(renameResult.ok).toBe(true);
    });
    Then('the stored draft is named "Summer Tapas Final"', () => {
      expect(workspace.getDraft.execute(draftId, hostId)?.content.name).toBe('Summer Tapas Final');
    });
    And('the audit log records the change with the previous and the new name', () => {
      const renameEvent = workspace.auditLog.findByContest(draftId).find((entry) => entry.type === 'draft.updated');
      expect((renameEvent?.before as DraftContent | undefined)?.name).toBe('Summer Tapas 2026');
      expect((renameEvent?.after as DraftContent | undefined)?.name).toBe('Summer Tapas Final');
    });
  });

  Scenario('A host discards a draft', ({ Given, When, Then, And }) => {
    let workspace: DraftWorkspace;
    const hostId = 'host-1';
    let draftId = '';

    Given('a host with a saved draft named "Summer Tapas 2026"', () => {
      workspace = makeDraftWorkspace();
      const creation = workspace.createDraft.execute(hostId, draftNamed('Summer Tapas 2026'));
      if (creation.ok) draftId = creation.draft.id;
    });
    When('the host discards the draft', () => {
      expect(workspace.discardDraft.execute(draftId, hostId).ok).toBe(true);
    });
    Then("the draft no longer appears among the host's drafts", () => {
      expect(workspace.listHostDrafts.execute(hostId)).toHaveLength(0);
    });
    And('the audit log records that the draft was discarded', () => {
      const wasDiscarded = workspace.auditLog.findByContest(draftId).some((entry) => entry.type === 'draft.discarded');
      expect(wasDiscarded).toBe(true);
    });
  });

  Scenario('A draft without a name cannot be saved', ({ Given, When, Then }) => {
    let workspace: DraftWorkspace;
    const hostId = 'host-1';
    let saveOutcome: ReturnType<CreateDraft['execute']>;

    Given('a host', () => void (workspace = makeDraftWorkspace()));
    When('the host tries to save a draft with no name', () => {
      saveOutcome = workspace.createDraft.execute(hostId, draftNamed(''));
    });
    Then('saving is rejected because a name is required', () => {
      expect(saveOutcome.ok).toBe(false);
      if (!saveOutcome.ok) expect(saveOutcome.error.code).toBe('NAME_REQUIRED');
    });
  });

  Scenario('A host only sees their own drafts', ({ Given, When, Then, And }) => {
    let workspace: DraftWorkspace;
    let visibleDraftNames: string[] = [];

    Given('a host with a saved draft named "Summer Tapas 2026"', () => {
      workspace = makeDraftWorkspace();
      workspace.createDraft.execute('host-1', draftNamed('Summer Tapas 2026'));
    });
    And('another host with a saved draft named "Winter Tapas"', () => {
      workspace.createDraft.execute('host-2', draftNamed('Winter Tapas'));
    });
    When('the host lists their drafts', () => {
      visibleDraftNames = workspace.listHostDrafts.execute('host-1').map((draft) => draft.content.name);
    });
    Then('only "Summer Tapas 2026" appears', () => {
      expect(visibleDraftNames).toEqual(['Summer Tapas 2026']);
    });
  });
});
