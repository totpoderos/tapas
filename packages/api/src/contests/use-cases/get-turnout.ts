import type { GetTurnoutDeps, GetTurnoutResult, TurnoutParticipant } from './shared.js';

/**
 * How the voting stands, as a PARTICIPANT may see it while waiting for the
 * reveal: how many votes are in, out of how many are expected, and who has
 * still to vote.
 *
 * This is a disclosure about other people, so what it does not carry matters as
 * much as what it does. It reports whether a vote is **in or not in**, and
 * nothing else — not whether someone has started, not how many dishes they have
 * scored, not which, and no value they gave. Whether a vote is in is the fact
 * the whole room is waiting on; how far through someone is, is theirs.
 *
 * That boundary is kept here rather than at the route, because the route can
 * only drop fields it is given, and a later field added to this result would
 * arrive at the participant's screen without anyone deciding it should.
 *
 * Distinct from `GetTally`, which answers the host's question — how many have
 * joined, drafted, sent — and names nobody. This one names people and is
 * therefore gated on having claimed a place in the same contest.
 */
export class GetTurnout {
  constructor(private readonly deps: GetTurnoutDeps) {}

  async execute(contestId: string): Promise<GetTurnoutResult> {
    const contest = await this.deps.contests.findById(contestId);
    if (!contest)
      return { ok: false, error: { code: 'CONTEST_NOT_FOUND', message: 'No such contest.' } };

    /*
     * A vote counts as in only when its session is `sent`. A draft session means
     * someone is part-way through, which is exactly the state this must not
     * distinguish from not having started — so both fall on the same side.
     */
    const sentBy = new Set(
      (await this.deps.voteSessions
        .listSessions(contestId))
        .filter((session) => session.status === 'sent')
        .map((session) => session.voterId),
    );

    const participants: TurnoutParticipant[] = (await this.deps.roster
      .listAll(contestId))
      .map((place) => ({
        participantId: place.participantId,
        displayName: place.displayName,
        sent: sentBy.has(place.participantId),
      }));

    return {
      ok: true,
      turnout: {
        votesIn: participants.filter((participant) => participant.sent).length,
        votesExpected: participants.length,
        participants,
      },
    };
  }
}
