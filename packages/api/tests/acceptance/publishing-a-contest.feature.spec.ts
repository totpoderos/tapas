import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import type { DraftContent } from '@tapas/domain';
import { expect } from 'vitest';
import {
  AuditRecorder,
  CreateDraft,
  createAuditProjection,
  GetContest,
  ListHostDrafts,
  PublishContest,
  runMigrations,
  SqliteAuditLogRepository,
  SqliteContestRepository,
  SqliteDraftRepository,
  SqliteRosterRepository,
  type Clock,
} from '../../src/index.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./publishing-a-contest.feature', import.meta.url)),
);

function makeContestWorkspace() {
  const db = new DatabaseSync(':memory:');
  runMigrations(db);
  const drafts = new SqliteDraftRepository(db);
  const contests = new SqliteContestRepository(db);
  const roster = new SqliteRosterRepository(db);
  const auditLog = new SqliteAuditLogRepository(db);
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
    listHostDrafts: new ListHostDrafts(drafts),
    auditLog,
  };
}

type ContestWorkspace = ReturnType<typeof makeContestWorkspace>;

function person(id: string, partnerId: string) {
  return { id, displayName: id, partnerId };
}

/** A complete, publishable draft: 4 people in 2 couples, each on their own, partners kept apart. */
function completeContent(name: string): DraftContent {
  return {
    name,
    format: 'solo_with_partners',
    scoring: {
      categories: [{ id: 'c1', name: 'Taste' }],
      range: { type: 'auto' },
      uniquePerCategory: true,
    },
    participants: [person('A', 'B'), person('B', 'A'), person('C', 'D'), person('D', 'C')],
  };
}

/**
 * Participants given by name alone — no id. This is what a host talking to the
 * assistant produces ("two participants: Juan and Paco"): an id is internal
 * identity, not something they say. `Person['id']` is required by the domain, so
 * the omission is expressed here the way it arrives over the wire.
 */
function namesOnlyContent(name: string): DraftContent {
  return {
    name,
    format: 'solo',
    scoring: {
      categories: [{ id: 'c1', name: 'Taste' }],
      range: { type: 'auto' },
      uniquePerCategory: true,
    },
    // `as unknown as` on purpose: the domain requires an id, and the point of
    // this case is content that arrives WITHOUT one, exactly as it does over the wire.
    participants: [{ displayName: 'Juan' }, { displayName: 'Paco' }] as unknown as DraftContent['participants'],
  };
}

/** A single couple with couples barred — the compiler rejects it (no one can score). */
function singleCoupleContent(name: string): DraftContent {
  return {
    name,
    format: 'solo_with_partners',
    scoring: {
      categories: [{ id: 'c1', name: 'Taste' }],
      range: { type: 'auto' },
      uniquePerCategory: true,
    },
    participants: [person('A', 'B'), person('B', 'A')],
  };
}

function saveDraft(workspace: ContestWorkspace, hostId: string, content: DraftContent): string {
  const creation = workspace.createDraft.execute(hostId, content);
  if (!creation.ok) throw new Error(`could not set up draft: ${creation.error.code}`);
  return creation.draft.id;
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('A host publishes a complete draft', ({ Given, When, Then, And }) => {
    let workspace: ContestWorkspace;
    const hostId = 'host-1';
    let draftId = '';

    Given(
      'a host with a complete draft named "Summer Tapas 2026" for 4 people in 2 couples, where everyone is on their own with partners kept apart',
      () => {
        workspace = makeContestWorkspace();
        draftId = saveDraft(workspace, hostId, completeContent('Summer Tapas 2026'));
      },
    );
    When('the host publishes the draft', () => {
      expect(workspace.publishContest.execute(draftId, hostId).ok).toBe(true);
    });
    Then('the draft becomes a live contest named "Summer Tapas 2026"', () => {
      const contest = workspace.getContest.execute(draftId);
      expect(contest?.status).toBe('live');
      expect(contest?.name).toBe('Summer Tapas 2026');
    });
    And('a join code is issued for the contest', () => {
      expect(workspace.getContest.execute(draftId)?.joinCode).toBeTruthy();
    });
    And("the draft no longer appears among the host's drafts", () => {
      expect(workspace.listHostDrafts.execute(hostId)).toHaveLength(0);
    });
    And('the audit log records that the contest was published', () => {
      const wasPublished = workspace.auditLog
        .findByContest(draftId)
        .some((entry) => entry.type === 'contest.published');
      expect(wasPublished).toBe(true);
    });
  });

  Scenario('A draft whose participants were given by name alone can be published', ({ Given, Then, When }) => {
    let workspace: ContestWorkspace;
    const hostId = 'host-1';
    let draftId = '';
    let contestId = '';

    Given('a host with a draft whose participants were listed by name only', () => {
      workspace = makeContestWorkspace();
      draftId = saveDraft(workspace, hostId, namesOnlyContent('Whatever'));
    });
    Then('each participant can be told apart from the others', () => {
      const saved = workspace.listHostDrafts.execute(hostId).find((draft) => draft.id === draftId);
      const ids = (saved?.content.participants ?? []).map((person) => person.id);
      expect(ids).toHaveLength(2);
      expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
      expect(new Set(ids).size).toBe(ids.length);
    });
    When('the host publishes that draft', () => {
      const published = workspace.publishContest.execute(draftId, hostId);
      expect(published.ok).toBe(true);
      if (published.ok) contestId = published.contest.id;
    });
    Then('the contest goes live', () => {
      expect(workspace.getContest.execute(contestId)?.status).toBe('live');
    });
  });

  Scenario('An incomplete draft cannot be published', ({ Given, When, Then, And }) => {
    let workspace: ContestWorkspace;
    const hostId = 'host-1';
    let draftId = '';
    let publishOutcome: ReturnType<PublishContest['execute']>;

    Given('a host with a draft named "Half-baked" that has no scoring rules yet', () => {
      workspace = makeContestWorkspace();
      draftId = saveDraft(workspace, hostId, { name: 'Half-baked' });
    });
    When('the host tries to publish the draft', () => {
      publishOutcome = workspace.publishContest.execute(draftId, hostId);
    });
    Then('publishing is rejected because the draft is incomplete', () => {
      expect(publishOutcome.ok).toBe(false);
      if (!publishOutcome.ok) expect(publishOutcome.error.code).toBe('INCOMPLETE_DRAFT');
    });
    And('no contest is created', () => {
      expect(workspace.getContest.execute(draftId)).toBeUndefined();
    });
  });

  Scenario(
    'A draft that leaves a judge unable to score cannot be published',
    ({ Given, When, Then, And }) => {
      let workspace: ContestWorkspace;
      const hostId = 'host-1';
      let draftId = '';
      let publishOutcome: ReturnType<PublishContest['execute']>;

      Given(
        'a host with a draft for a single couple, where everyone is on their own with partners kept apart',
        () => {
          workspace = makeContestWorkspace();
          draftId = saveDraft(workspace, hostId, singleCoupleContent('Just us'));
        },
      );
      When('the host tries to publish the draft', () => {
        publishOutcome = workspace.publishContest.execute(draftId, hostId);
      });
      Then('publishing is rejected because a judge could score nothing', () => {
        expect(publishOutcome.ok).toBe(false);
        if (!publishOutcome.ok)
          expect(publishOutcome.error.code).toBe('JUDGE_CANNOT_SCORE_ANY_DISH');
      });
      And('no contest is created', () => {
        expect(workspace.getContest.execute(draftId)).toBeUndefined();
      });
    },
  );

  Scenario('A contest for couples cannot be published while somebody has no partner', ({ Given, When, Then, And }) => {
    let workspace: ContestWorkspace;
    const hostId = 'host-1';
    let draftId = '';
    let result: ReturnType<ContestWorkspace['publishContest']['execute']>;

    Given(
      'a host with a draft where couples cook together, for 5 people of whom 4 are 2 couples and 1 has no partner',
      () => {
        workspace = makeContestWorkspace();
        draftId = saveDraft(workspace, hostId, {
          ...completeContent('Odd One Out'),
          format: 'couples',
          participants: [
            person('maria', 'pau'),
            person('pau', 'maria'),
            person('ana', 'marcos'),
            person('marcos', 'ana'),
            { id: 'eva', displayName: 'eva' },
          ],
        });
      },
    );
    When('the host tries to publish the draft', () => {
      result = workspace.publishContest.execute(draftId, hostId);
    });
    Then('publishing is rejected because a participant has no partner', () => {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('UNPARTNERED_IN_COUPLES');
    });
    And('no contest is created', () => {
      expect(workspace.getContest.execute(draftId)).toBeUndefined();
    });
  });

  Scenario('A contest for couples publishes once everybody is partnered', ({ Given, When, Then, And }) => {
    let workspace: ContestWorkspace;
    const hostId = 'host-1';
    let draftId = '';

    Given(
      'a host with a complete draft named "Two by Two" for 6 people in 3 couples, where couples cook together',
      () => {
        workspace = makeContestWorkspace();
        draftId = saveDraft(workspace, hostId, {
          ...completeContent('Two by Two'),
          format: 'couples',
          participants: [
            person('maria', 'pau'),
            person('pau', 'maria'),
            person('ana', 'marcos'),
            person('marcos', 'ana'),
            person('eva', 'luis'),
            person('luis', 'eva'),
          ],
        });
      },
    );
    When('the host publishes the draft', () => {
      expect(workspace.publishContest.execute(draftId, hostId).ok).toBe(true);
    });
    Then('the contest goes live', () => {
      expect(workspace.getContest.execute(draftId)?.status).toBe('live');
    });
    And('each couple has one dish between them', () => {
      const dishes = workspace.getContest.execute(draftId)?.materialized.dishes ?? [];
      expect(dishes).toHaveLength(3);
      expect(dishes.every((dish) => dish.submitterIds.length === 2)).toBe(true);
    });
  });

  Scenario("A host cannot publish another host's draft", ({ Given, When, Then, And }) => {
    let workspace: ContestWorkspace;
    let draftId = '';

    Given(
      'a host with a complete draft named "Summer Tapas 2026" for 4 people in 2 couples, where everyone is on their own with partners kept apart',
      () => {
        workspace = makeContestWorkspace();
        draftId = saveDraft(workspace, 'host-1', completeContent('Summer Tapas 2026'));
      },
    );
    And('another host', () => {
      // "host-2" is simply a different identity
    });
    let publishOutcome: ReturnType<PublishContest['execute']>;
    When('the other host tries to publish the draft', () => {
      publishOutcome = workspace.publishContest.execute(draftId, 'host-2');
    });
    Then('publishing is rejected because the draft is not theirs', () => {
      expect(publishOutcome.ok).toBe(false);
      if (!publishOutcome.ok) expect(publishOutcome.error.code).toBe('DRAFT_NOT_FOUND');
    });
  });

  Scenario('Each published contest gets its own join code', ({ Given, When, Then }) => {
    let workspace: ContestWorkspace;
    const hostId = 'host-1';
    let firstDraftId = '';
    let secondDraftId = '';
    let firstJoinCode = '';
    let secondJoinCode = '';

    Given('a host with two complete drafts', () => {
      workspace = makeContestWorkspace();
      firstDraftId = saveDraft(workspace, hostId, completeContent('First'));
      secondDraftId = saveDraft(workspace, hostId, completeContent('Second'));
    });
    When('the host publishes both drafts', () => {
      const firstPublish = workspace.publishContest.execute(firstDraftId, hostId);
      const secondPublish = workspace.publishContest.execute(secondDraftId, hostId);
      if (firstPublish.ok) firstJoinCode = firstPublish.contest.joinCode;
      if (secondPublish.ok) secondJoinCode = secondPublish.contest.joinCode;
    });
    Then('the two contests have different join codes', () => {
      expect(firstJoinCode).not.toBe('');
      expect(firstJoinCode).not.toBe(secondJoinCode);
    });
  });
});
