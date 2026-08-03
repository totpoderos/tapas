import { fileURLToPath } from 'node:url';
import { freshDatabase } from '../support/test-database.js';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import type { DraftContent } from '@tapas/domain';
import { expect } from 'vitest';
import {
  AuditRecorder,
  CreateDraft,
  createAuditProjection,
  DeleteContest,
  GetDraft,
  ListHostDrafts,
  RenameDraft,
    SqliteAuditLogRepository,
  SqliteContestRepository,
  SqliteDishRepository,
  SqliteDraftRepository,
  SqliteRosterRepository,
  DatabaseUnitOfWork,
  SqliteVoteSessionRepository,
  type Clock,
  type IdGenerator,
} from '../../src/index.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./managing-a-contest-draft.feature', import.meta.url)),
);

async function makeDraftWorkspace() {
  const { database } = await freshDatabase();
  const drafts = new SqliteDraftRepository(database);
  const auditLog = new SqliteAuditLogRepository(database);
  let sequence = 0;
  const ids: IdGenerator = { next: () => `id-${++sequence}` };
  const clock: Clock = { now: () => '2026-07-19T10:00:00.000Z' };
  const audit = new AuditRecorder(auditLog, createAuditProjection({ clock, ids }));
  const deps = { drafts, audit, clock, ids };
  return {
    createDraft: new CreateDraft(deps),
    renameDraft: new RenameDraft(deps),
    // Discarding a draft IS deleting a contest: one host intent, one rule, and a
    // draft's stored content names participants, so it is erased rather than
    // copied into the log (which is what the old `draft.discarded` record did).
    deleteContest: new DeleteContest({
      contests: new SqliteContestRepository(database),
      drafts,
      roster: new SqliteRosterRepository(database),
      dishes: new SqliteDishRepository(database),
      voteSessions: new SqliteVoteSessionRepository(database, clock),
      audit,
      unitOfWork: new DatabaseUnitOfWork(database),
    }),
    getDraft: new GetDraft(drafts),
    listHostDrafts: new ListHostDrafts(drafts),
    auditLog,
  };
}

type DraftWorkspace = Awaited<ReturnType<typeof makeDraftWorkspace>>;

function draftNamed(name: string): DraftContent {
  return {
    name,
    format: 'solo_with_partners',
    scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'auto' }, uniquePerCategory: true },
    participants: [],
  };
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('A host saves a new draft', ({ Given, When, Then, And }) => {
    let workspace: DraftWorkspace;
    const hostId = 'host-1';
    let savedDraftId = '';

    Given('a host', async () => void (workspace = await makeDraftWorkspace()));
    When('the host saves a draft named "Summer Tapas 2026" where everyone is on their own with partners kept apart', async () => {
      const creation = await workspace.createDraft.execute(hostId, draftNamed('Summer Tapas 2026'));
      expect(creation.ok).toBe(true);
      if (creation.ok) savedDraftId = creation.draft.id;
    });
    Then('the draft is stored', async () => {
      expect(await workspace.getDraft.execute(savedDraftId, hostId)).toBeDefined();
    });
    And("the draft appears among the host's drafts", async () => {
      const draftNames = (await workspace.listHostDrafts.execute(hostId)).map((draft) => draft.content.name);
      expect(draftNames).toContain('Summer Tapas 2026');
    });
    And('the audit log records that the draft was saved by that host', async () => {
      const savedEvent = (await workspace.auditLog.findByContest(savedDraftId)).find((entry) => entry.type === 'draft.saved');
      expect(savedEvent?.actorId).toBe(hostId);
      expect(savedEvent?.sourcePath).toBe('form');
    });
  });

  Scenario('A host edits a draft', ({ Given, When, Then, And }) => {
    let workspace: DraftWorkspace;
    const hostId = 'host-1';
    let draftId = '';

    Given('a host with a saved draft named "Summer Tapas 2026"', async () => {
      workspace = await makeDraftWorkspace();
      const creation = await workspace.createDraft.execute(hostId, draftNamed('Summer Tapas 2026'));
      if (creation.ok) draftId = creation.draft.id;
    });
    When('the host renames the draft to "Summer Tapas Final"', async () => {
      const renameResult = await workspace.renameDraft.execute(draftId, hostId, 'Summer Tapas Final');
      expect(renameResult.ok).toBe(true);
    });
    Then('the stored draft is named "Summer Tapas Final"', async () => {
      expect((await workspace.getDraft.execute(draftId, hostId))?.content.name).toBe('Summer Tapas Final');
    });
    And('the audit log records the change with the previous and the new name', async () => {
      const renameEvent = (await workspace.auditLog.findByContest(draftId)).find((entry) => entry.type === 'draft.updated');
      expect((renameEvent?.before as DraftContent | undefined)?.name).toBe('Summer Tapas 2026');
      expect((renameEvent?.after as DraftContent | undefined)?.name).toBe('Summer Tapas Final');
    });
  });

  Scenario('A host discards a draft', ({ Given, When, Then, And }) => {
    let workspace: DraftWorkspace;
    const hostId = 'host-1';
    let draftId = '';

    Given('a host with a saved draft named "Summer Tapas 2026"', async () => {
      workspace = await makeDraftWorkspace();
      const creation = await workspace.createDraft.execute(hostId, draftNamed('Summer Tapas 2026'));
      if (creation.ok) draftId = creation.draft.id;
    });
    When('the host discards the draft', async () => {
      expect((await workspace.deleteContest.execute(draftId, hostId)).ok).toBe(true);
    });
    Then("the draft no longer appears among the host's drafts", async () => {
      expect(await workspace.listHostDrafts.execute(hostId)).toHaveLength(0);
    });
    And('nothing recorded about it remains except that it was deleted', async () => {
      const entries = await workspace.auditLog.findByContest(draftId);
      expect(entries.map((entry) => entry.type)).toEqual(['contest.deleted']);
      // The draft's content named a participant; the tombstone must not.
      expect(entries[0]?.before).toBeUndefined();
      expect(entries[0]?.after).toBeUndefined();
    });
  });

  Scenario('A draft without a name cannot be saved', ({ Given, When, Then }) => {
    let workspace: DraftWorkspace;
    const hostId = 'host-1';
    let saveOutcome: Awaited<ReturnType<CreateDraft['execute']>>;

    Given('a host', async () => void (workspace = await makeDraftWorkspace()));
    When('the host tries to save a draft with no name', async () => {
      saveOutcome = await workspace.createDraft.execute(hostId, draftNamed(''));
    });
    Then('saving is rejected because a name is required', () => {
      expect(saveOutcome.ok).toBe(false);
      if (!saveOutcome.ok) expect(saveOutcome.error.code).toBe('NAME_REQUIRED');
    });
  });

  Scenario('A host only sees their own drafts', ({ Given, When, Then, And }) => {
    let workspace: DraftWorkspace;
    let visibleDraftNames: string[] = [];

    Given('a host with a saved draft named "Summer Tapas 2026"', async () => {
      workspace = await makeDraftWorkspace();
      await workspace.createDraft.execute('host-1', draftNamed('Summer Tapas 2026'));
    });
    And('another host with a saved draft named "Winter Tapas"', async () => {
      await workspace.createDraft.execute('host-2', draftNamed('Winter Tapas'));
    });
    When('the host lists their drafts', async () => {
      visibleDraftNames = (await workspace.listHostDrafts.execute('host-1')).map((draft) => draft.content.name);
    });
    Then('only "Summer Tapas 2026" appears', () => {
      expect(visibleDraftNames).toEqual(['Summer Tapas 2026']);
    });
  });
});
