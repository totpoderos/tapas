import type { PublishErrorCode, TallyResult } from '@tapas/domain';
import type { Clock } from '../../audit/audit-projection.js';
import type { AuditProvenance } from '../../audit/audit-projection.js';
import type { AuditRecorder } from '../../audit/audit-recorder.js';
import type { ContestRepository } from '../../db/contest-repository.js';
import type { DishRepository } from '../../db/dish-repository.js';
import type { DraftRepository } from '../../db/draft-repository.js';
import type { RosterRepository } from '../../db/roster-repository.js';
import type { UnitOfWork } from '../../db/unit-of-work.js';
import type { VoteSessionRepository } from '../../db/vote-session-repository.js';
import type { JoinCodeGenerator } from '../join-code-generator.js';
import type { StoredContest } from '../stored-contest.js';

export type PublishFailureCode = 'DRAFT_NOT_FOUND' | PublishErrorCode;

export interface PublishFailure {
  readonly code: PublishFailureCode;
  readonly message: string;
}

export interface PublishContestDeps {
  readonly drafts: DraftRepository;
  readonly contests: ContestRepository;
  readonly roster: RosterRepository;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly joinCodes: JoinCodeGenerator;
}

export type PublishContestResult =
  | { readonly ok: true; readonly contest: StoredContest }
  | { readonly ok: false; readonly error: PublishFailure };

export type CloseContestErrorCode = 'CONTEST_NOT_FOUND' | 'ALREADY_CLOSED';

export interface CloseContestError {
  readonly code: CloseContestErrorCode;
  readonly message: string;
}

export interface CloseContestDeps {
  readonly contests: ContestRepository;
  readonly clock: Clock;
  readonly audit: AuditRecorder;
}

export type CloseContestResult =
  | { readonly ok: true; readonly contest: StoredContest }
  | { readonly ok: false; readonly error: CloseContestError };

export type RevealContestErrorCode = 'CONTEST_NOT_FOUND' | 'NOT_CLOSED' | 'ALREADY_REVEALED';

export interface RevealContestError {
  readonly code: RevealContestErrorCode;
  readonly message: string;
}

export interface RevealContestDeps {
  readonly contests: ContestRepository;
  readonly clock: Clock;
  readonly audit: AuditRecorder;
}

/** How a status-changing action was triggered, for the audit trail. */
export interface StatusChangeContext {
  readonly actorId: string;
  /** 'host' when the host confirmed it (e.g. via the assistant), else 'auto'. */
  readonly confirmation: 'host' | 'auto';
  /**
   * How the action reached the API. Absent means the app — the two travel
   * separately from `confirmation` because they answer different questions:
   * whether anyone agreed to this, and how it arrived.
   */
  readonly provenance?: AuditProvenance;
}

export type RevealContestResult =
  | { readonly ok: true; readonly contest: StoredContest }
  | { readonly ok: false; readonly error: RevealContestError };

export type GetResultsErrorCode = 'CONTEST_NOT_FOUND' | 'NOT_REVEALED';

export interface GetResultsError {
  readonly code: GetResultsErrorCode;
  readonly message: string;
}

export interface GetResultsDeps {
  readonly contests: ContestRepository;
  readonly voteSessions: VoteSessionRepository;
}

export type GetResultsResult =
  | { readonly ok: true; readonly results: TallyResult }
  | { readonly ok: false; readonly error: GetResultsError };

export type DeleteContestErrorCode = 'CONTEST_NOT_FOUND' | 'NOT_ALLOWED' | 'CONFIRMATION_REQUIRED';

export interface DeleteContestError {
  readonly code: DeleteContestErrorCode;
  readonly message: string;
}

/**
 * Everything a contest is spread across. None of these tables cascade, so each
 * one is named here — a table added later that holds part of a contest has to be
 * added here too, or its rows outlive the contest.
 */
export interface DeleteContestDeps {
  readonly contests: ContestRepository;
  readonly drafts: DraftRepository;
  readonly roster: RosterRepository;
  readonly dishes: DishRepository;
  readonly voteSessions: VoteSessionRepository;
  readonly audit: AuditRecorder;
  readonly unitOfWork: UnitOfWork;
}

export type DeleteContestResult =
  | { readonly ok: true; readonly name: string }
  | { readonly ok: false; readonly error: DeleteContestError };

export type GetTallyErrorCode = 'CONTEST_NOT_FOUND';

export interface GetTallyError {
  readonly code: GetTallyErrorCode;
  readonly message: string;
}

export interface GetTallyDeps {
  readonly contests: ContestRepository;
  readonly roster: RosterRepository;
  readonly voteSessions: VoteSessionRepository;
}

export interface Tally {
  /**
   * How many places the roster holds — what the other counts are out of.
   *
   * Without it a host reads "two have joined" and cannot tell a full room from a
   * nearly empty one, which is the question they are actually asking while the
   * contest runs.
   */
  readonly placeCount: number;
  readonly claimedCount: number;
  readonly draftCount: number;
  readonly sentCount: number;
}

export type GetTallyResult =
  | { readonly ok: true; readonly tally: Tally }
  | { readonly ok: false; readonly error: GetTallyError };

export type GetTurnoutErrorCode = 'CONTEST_NOT_FOUND';

export interface GetTurnoutError {
  readonly code: GetTurnoutErrorCode;
  readonly message: string;
}

export interface GetTurnoutDeps {
  readonly contests: ContestRepository;
  readonly roster: RosterRepository;
  readonly voteSessions: VoteSessionRepository;
}

/**
 * One participant, as another participant may see them while waiting.
 *
 * Two fields and no third. `sent` is deliberately a boolean rather than a
 * status: a vote is either in or it is not, and how far someone has got —
 * whether they have started, how many dishes they have scored, what they gave —
 * is that person's business and is not derivable from anything here.
 */
export interface TurnoutParticipant {
  readonly participantId: string;
  readonly displayName: string;
  readonly sent: boolean;
}

export interface Turnout {
  readonly votesIn: number;
  /**
   * Every place the host listed, claimed or not — the same denominator the dish
   * screen counts against. A place nobody took can never produce a vote, so
   * counting only the claimed ones would read "everyone has voted" while the
   * reveal does not come, with nothing on screen to explain why.
   */
  readonly votesExpected: number;
  readonly participants: readonly TurnoutParticipant[];
}

export type GetTurnoutResult =
  | { readonly ok: true; readonly turnout: Turnout }
  | { readonly ok: false; readonly error: GetTurnoutError };
