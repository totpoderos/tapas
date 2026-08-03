import { fileURLToPath } from 'node:url';
import { freshDatabase } from '../support/test-database.js';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import type { DraftContent } from '@tapas/domain';
import { expect } from 'vitest';
import {
  AuditRecorder,
  CreateDraft,
  createAuditProjection,
  GetContest,
  PublishContest,
  refusalOf,
  SqliteAuditLogRepository,
  SqliteContestRepository,
  SqliteDraftRepository,
  SqliteRosterRepository,
  type Clock,
} from '../../src/index.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./a-refusal-says-what-it-is-about.feature', import.meta.url)),
);

async function makeWorkspace() {
  const { database } = await freshDatabase();
  const drafts = new SqliteDraftRepository(database);
  const contests = new SqliteContestRepository(database);
  const roster = new SqliteRosterRepository(database);
  const auditLog = new SqliteAuditLogRepository(database);
  let auditSequence = 0;
  const ids = { next: () => `audit-${++auditSequence}` };
  const clock: Clock = { now: () => '2026-07-19T10:00:00.000Z' };
  let joinCodeSequence = 0;
  const joinCodes = { next: () => `JOIN-${++joinCodeSequence}` };
  const audit = new AuditRecorder(auditLog, createAuditProjection({ clock, ids }));

  return {
    createDraft: new CreateDraft({ drafts, audit, clock, ids }),
    publishContest: new PublishContest({ drafts, contests, roster, audit, clock, joinCodes }),
    getContest: new GetContest(contests),
  };
}

type Workspace = Awaited<ReturnType<typeof makeWorkspace>>;
type Refusal = { code: string; message: string; details?: Record<string, unknown> };

async function saveDraft(workspace: Workspace, hostId: string, content: DraftContent): Promise<string> {
  const creation = await workspace.createDraft.execute(hostId, content);
  if (!creation.ok) throw new Error(`could not set up draft: ${creation.error.code}`);
  return creation.draft.id;
}

const HOST = 'host-1';
const judgedOnTaste = { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'auto' } as const, uniquePerCategory: false };

describeFeature(feature, ({ Scenario }) => {
  let workspace: Workspace;
  let draftId = '';
  let refusal: Refusal;

  const publishing = async () => {
    const published = await workspace.publishContest.execute(draftId, HOST);
    expect(published.ok).toBe(false);
    if (published.ok) throw new Error('expected a refusal');
    refusal = published.error as unknown as Refusal;
  };

  Scenario('A refusal about somebody without a partner says who', ({ Given, When, Then, And }) => {
    Given(
      'a host with a draft where couples cook together, for 5 people of whom 4 are 2 couples and 1 has no partner',
      async () => {
        workspace = await makeWorkspace();
        draftId = await saveDraft(workspace, HOST, {
          name: 'Odd One Out',
          format: 'couples',
          scoring: judgedOnTaste,
          participants: [
            { id: 'a', displayName: 'Ana', partnerId: 'b' },
            { id: 'b', displayName: 'Bruno', partnerId: 'a' },
            { id: 'c', displayName: 'Carla', partnerId: 'd' },
            { id: 'd', displayName: 'Diego', partnerId: 'c' },
            { id: 'e', displayName: 'Elena' },
          ],
        });
      },
    );
    When('the host tries to publish the draft', publishing);
    Then('publishing is rejected because a participant has no partner', () => {
      expect(refusal.code).toBe('UNPARTNERED_IN_COUPLES');
    });
    And('the refusal says which person it is about', () => {
      expect(refusal.details).toEqual({ person: 'Elena' });
    });
    And('it still reads as a sentence', () => {
      expect(refusal.message).toContain('Elena');
      expect(refusal.message.trim().endsWith('.')).toBe(true);
    });
  });

  Scenario('A refusal about two people who cannot be told apart names them', ({ Given, When, Then, And }) => {
    Given('a host with a draft in which two of the people taking part cannot be told apart', async () => {
      workspace = await makeWorkspace();
      draftId = await saveDraft(workspace, HOST, {
        name: 'Seeing Double',
        format: 'solo',
        scoring: judgedOnTaste,
        // The same identity under two names — what an authoring path that
        // invented ids could produce, and what publishing is there to catch.
        participants: [
          { id: 'p3f7a', displayName: 'Ana' },
          { id: 'p3f7a', displayName: 'Bruno' },
        ],
      });
    });
    When('the host tries to publish the draft', publishing);
    Then('publishing is rejected because two of the people cannot be told apart', () => {
      expect(refusal.code).toBe('DUPLICATE_PERSON_ID');
    });
    And('the refusal names those two people as the host named them', () => {
      expect(refusal.details).toEqual({ first: 'Ana', second: 'Bruno' });
      expect(refusal.message).toContain('Ana');
      expect(refusal.message).toContain('Bruno');
    });
    And('the refusal quotes nothing the host has never been shown', () => {
      expect(refusal.message).not.toContain('p3f7a');
      expect(JSON.stringify(refusal.details)).not.toContain('p3f7a');
    });
  });

  Scenario('A refusal about two things judged on that are one thing names them', ({ Given, When, Then }) => {
    Given('a host with a draft judged on two things that cannot be told apart', async () => {
      workspace = await makeWorkspace();
      draftId = await saveDraft(workspace, HOST, {
        name: 'Two That Are One',
        format: 'solo',
        scoring: {
          categories: [
            { id: 'c1', name: 'Taste' },
            { id: 'c1', name: 'Originality' },
          ],
          range: { type: 'auto' },
          uniquePerCategory: false,
        },
        participants: [
          { id: 'a', displayName: 'Ana' },
          { id: 'b', displayName: 'Bruno' },
        ],
      });
    });
    When('the host tries to publish the draft', publishing);
    Then('the refusal names both of those things as the host named them', () => {
      expect(refusal.details).toEqual({ first: 'Taste', second: 'Originality' });
    });
  });

  Scenario('A refusal about what is still unsaid says which things', ({ Given, When, Then, And }) => {
    Given('a host with a draft that has only a name', async () => {
      workspace = await makeWorkspace();
      draftId = await saveDraft(workspace, HOST, { name: 'Bare' });
    });
    When('the host tries to publish the draft', publishing);
    Then('publishing is rejected naming all three of the things it still needs', () => {
      expect(refusal.code).toBe('INCOMPLETE_DRAFT');
      for (const said of ['what kind of contest it is', 'who is taking part', 'how it is scored']) {
        expect(refusal.message).toContain(said);
      }
    });
    /*
     * The gaps themselves, not the phrases the English sentence joins them into.
     * A reader with its own words has its own way of listing things, and its own
     * word for "or".
     */
    And('the refusal says which things are still unsaid, each on its own', () => {
      expect(refusal.details).toEqual({ unsaid: ['format', 'participants', 'scoring'] });
    });
  });

  Scenario('A refusal that is about nothing in particular carries no facts', ({ Given, When, Then, And }) => {
    Given(
      'a host with a draft that says what kind of contest it is and who is taking part, but is judged on nothing',
      async () => {
        workspace = await makeWorkspace();
        draftId = await saveDraft(workspace, HOST, {
          name: 'Judged On Nothing',
          format: 'solo',
          scoring: { categories: [], range: { type: 'auto' }, uniquePerCategory: false },
          participants: [
            { id: 'a', displayName: 'Ana' },
            { id: 'b', displayName: 'Bruno' },
          ],
        });
      },
    );
    When('the host tries to publish the draft', publishing);
    Then('publishing is rejected because the contest is judged on nothing', () => {
      expect(refusal.code).toBe('NO_CATEGORIES');
    });
    And('the refusal is about no particular person or thing', () => {
      expect(refusal.details).toBeUndefined();
    });
  });

  /*
   * The assistant reads the same refusal off the wire and has no words of its
   * own, so what it must keep getting is the sentence. `refusalOf` is the step
   * that used to narrow the refusal to a string; this holds it to still carrying
   * one.
   */
  Scenario("A reader with no words of its own still gets the sentence", ({ Given, When, Then }) => {
    let body: unknown;

    Given(
      'a host with a draft where couples cook together, for 5 people of whom 4 are 2 couples and 1 has no partner',
      async () => {
        workspace = await makeWorkspace();
        draftId = await saveDraft(workspace, HOST, {
          name: 'Odd One Out',
          format: 'couples',
          scoring: judgedOnTaste,
          participants: [
            { id: 'a', displayName: 'Ana', partnerId: 'b' },
            { id: 'b', displayName: 'Bruno', partnerId: 'a' },
            { id: 'c', displayName: 'Carla', partnerId: 'd' },
            { id: 'd', displayName: 'Diego', partnerId: 'c' },
            { id: 'e', displayName: 'Elena' },
          ],
        });
      },
    );
    When("the assistant is asked to publish that draft on the host's behalf", async () => {
      const published = await workspace.publishContest.execute(draftId, HOST);
      if (published.ok) throw new Error('expected a refusal');
      body = { error: published.error };
    });
    Then('the assistant is told, in words, why it could not be published', () => {
      const read = refusalOf(body);
      expect(read.message).toContain('Elena');
      expect(read.code).toBe('UNPARTNERED_IN_COUPLES');
      expect(read.details).toEqual({ person: 'Elena' });
    });
  });
});
