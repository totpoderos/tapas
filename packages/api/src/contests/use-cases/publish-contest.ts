import { Contest } from '@tapas/domain';
import { findOwnedDraft } from '../../drafts/use-cases/shared.js';
import type { StoredContest } from '../stored-contest.js';
import type { PublishContestDeps, PublishContestResult } from './shared.js';

/**
 * Publishes a host's own draft into a live contest: compiles the scoring rules
 * (via the domain `Contest`), issues a join code, persists the contest, retires
 * the draft, and records `contest.published`. The draft's id carries through.
 */
export class PublishContest {
  constructor(private readonly deps: PublishContestDeps) {}

  execute(draftId: string, hostId: string): PublishContestResult {
    const draft = findOwnedDraft(this.deps.drafts, draftId, hostId);
    if (!draft) return { ok: false, error: { code: 'DRAFT_NOT_FOUND', message: 'No such draft.' } };

    const joinCode = this.deps.joinCodes.next();
    const published = Contest.publish({ id: draft.id, hostId, content: draft.content }, joinCode);
    if (!published.ok) return { ok: false, error: published.error };

    const stored: StoredContest = {
      id: published.contest.id,
      hostId,
      name: published.contest.name,
      joinCode,
      status: 'live',
      materialized: published.contest.materialized,
      // Kept from the draft: the compiled view records what the format does
      // (which dishes exist, and who may score them) rather than the format
      // itself, and that is lossy — where nobody has a partner, `solo` and
      // `solo_with_partners` compile to exactly the same thing. The draft is
      // retired below, so if the contest does not carry it, nothing does.
      ...(draft.content.format === undefined ? {} : { format: draft.content.format }),
      closeRule: published.contest.closeRule,
      revealStrategy: published.contest.revealStrategy,
      createdAt: this.deps.clock.now(),
      closedAt: null,
      revealedAt: null,
    };
    this.deps.contests.insert(stored);
    // Seed the roster: one open place per listed participant, keyed by the id
    // the compiled view uses — so a claim links straight to the scoring rules.
    this.deps.roster.seed(
      stored.id,
      (draft.content.participants ?? []).map((participant) => ({
        participantId: participant.id,
        displayName: participant.displayName,
      })),
    );
    this.deps.drafts.delete(draftId); // retire the draft — it is a contest now

    this.deps.audit.record(
      {
        type: 'contest.published',
        contestId: stored.id,
        actorId: hostId,
        after: { name: stored.name, joinCode },
      },
      { sourcePath: 'system' },
    );
    return { ok: true, contest: stored };
  }
}
