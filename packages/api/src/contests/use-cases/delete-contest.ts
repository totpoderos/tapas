import { IN_APP, type AuditProvenance } from '../../audit/audit-projection.js';
import type { DeleteContestDeps, DeleteContestResult } from './shared.js';

/** Whether the contest has anything of anyone else's invested in it yet. */
function anyoneHasTakenPart(deps: DeleteContestDeps, contestId: string): boolean {
  return (
    deps.roster.listClaimed(contestId).length > 0 ||
    deps.voteSessions.listSessions(contestId).length > 0
  );
}

/**
 * Deletes a contest a host owns — at any point in its life — and everything held
 * about it: the roster, the dishes, every vote session and score, and its
 * recorded history. It resolves the id against a **draft or a published
 * contest**, which share one id space (`PublishContest` carries the draft's id
 * through), so one host-facing action covers the whole lifecycle. Two routes for
 * one intent is the "one destination, two paths" shape behind the defects in
 * docs/threat-model.md §4.
 *
 * **This is the only place in the system that reduces the audit log**, and it is
 * deliberate. The log stores participant names inside recorded draft content
 * (`draft.saved` keeps the whole `DraftContent`), so deleting a contest while
 * sparing the log would erase nothing that actually identifies anyone — the UI
 * would say "deleted" and be wrong. What survives is a tombstone: `contest.deleted`
 * carrying who, when, through which path, and that it was confirmed — and **no**
 * `before`/`after` payload, because those are the very things being erased. That
 * keeps the accountability OWASP A09 asks for (that a destructive act happened)
 * without keeping what the host asked to destroy.
 *
 * The whole thing runs in one transaction: a half-delete would leave a contest
 * whose votes were gone but whose row survived, or a history erased with no
 * tombstone in its place.
 */
export class DeleteContest {
  constructor(private readonly deps: DeleteContestDeps) {}

  execute(
    contestId: string,
    hostId: string,
    options: {
      readonly confirmName?: string;
      readonly confirmation?: 'host' | 'auto';
      readonly provenance?: AuditProvenance;
    } = {},
  ): DeleteContestResult {
    const contest = this.deps.contests.findById(contestId);
    const draft = contest ? undefined : this.deps.drafts.findById(contestId);
    const owner = contest?.hostId ?? draft?.hostId;

    if (owner === undefined) {
      return { ok: false, error: { code: 'CONTEST_NOT_FOUND', message: 'No such contest.' } };
    }
    if (owner !== hostId) {
      return { ok: false, error: { code: 'NOT_ALLOWED', message: 'Not allowed.' } };
    }

    const name = contest?.name ?? draft?.content.name ?? '';

    // The guard lives here, not in the dialog: every entry point — form, MCP,
    // assistant — passes through this use case, so a screen cannot be the only
    // thing standing between a mis-click and sixteen people's votes.
    if (contest && anyoneHasTakenPart(this.deps, contestId) && options.confirmName !== name) {
      return {
        ok: false,
        error: {
          code: 'CONFIRMATION_REQUIRED',
          message: 'Type the contest’s name to confirm deleting it.',
        },
      };
    }

    this.deps.unitOfWork.run(() => {
      if (contest) {
        this.deps.voteSessions.deleteByContest(contestId);
        this.deps.dishes.deleteByContest(contestId);
        this.deps.roster.deleteByContest(contestId);
        this.deps.contests.delete(contestId);
      } else {
        this.deps.drafts.delete(contestId);
      }

      // Erase the history, then mark that it was erased. Order matters: the
      // tombstone must not be caught by the deletion it is recording.
      this.deps.audit.deleteByContest(contestId);
      this.deps.audit.record(
        { type: 'contest.deleted', contestId, actorId: hostId },
        // An action the host asked their assistant for is recorded as having come
        // through a connected tool; one taken in the app is recorded as the app's.
        // What this still cannot tell apart is an **external MCP client** holding
        // a PAT: that does not pass through the assistant's dispatch, and the API
        // deliberately cannot tell such a session from an in-app one
        // (require-host-session.ts). Its use stays accountable through the
        // security event log (`pat.used`) rather than through this field.
        { ...(options.provenance ?? IN_APP), confirmation: options.confirmation ?? 'host' },
      );
    });

    return { ok: true, name };
  }
}
