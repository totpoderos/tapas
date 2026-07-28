import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuditLogRepository } from '../db/audit-repository.js';
import type { ContestRepository } from '../db/contest-repository.js';

/** The tombstone `DeleteContest` leaves in place of a contest's erased history. */
const DELETED = 'contest.deleted';

const contestDeleted = {
  error: { code: 'CONTEST_DELETED', message: 'The host deleted this contest.' },
};

export interface RefuseDeletedContestDeps {
  readonly contests: ContestRepository;
  readonly auditLog: AuditLogRepository;
}

/**
 * Fastify preHandler for voter-scoped routes: when the contest a voter holds a
 * token for has been deleted, answer `410 Gone` rather than letting the route
 * fall through to a bare `404`.
 *
 * Why participants get told and the former host does not: deleting a contest
 * removes the row that held its `host_id`, so afterwards the system genuinely
 * **cannot** tell its former owner from a stranger — the host gets 404 on
 * everything, and that is forced by the design, not chosen. A voter is different:
 * their token is scoped to this `contestId`, so possessing it already proves
 * prior association and naming the contest reveals nothing they did not know.
 *
 * It sits on the one seam every voter-scoped route already passes through, so a
 * new route cannot forget it and start reporting a deleted contest as one that
 * never existed.
 */
export function refuseDeletedContest(deps: RefuseDeletedContestDeps) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const contestId = request.voterSession?.contestId;
    if (!contestId) return; // no session — requireVoterSession has already answered
    if (deps.contests.findById(contestId)) return; // still there, nothing to say

    const tombstoned = deps.auditLog
      .findByContest(contestId)
      .some((entry) => entry.type === DELETED);
    if (tombstoned) await reply.code(410).send(contestDeleted);
  };
}
