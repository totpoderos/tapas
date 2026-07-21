import type { PublishErrorCode, TallyResult } from '@tapas/domain';
import type { Clock } from '../../audit/audit-projection.js';
import type { AuditRecorder } from '../../audit/audit-recorder.js';
import type { ContestRepository } from '../../db/contest-repository.js';
import type { DraftRepository } from '../../db/draft-repository.js';
import type { RosterRepository } from '../../db/roster-repository.js';
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
