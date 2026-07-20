import type { PublishErrorCode } from '@tapas/domain';
import type { Clock } from '../../audit/audit-projection.js';
import type { AuditRecorder } from '../../audit/audit-recorder.js';
import type { ContestRepository } from '../../db/contest-repository.js';
import type { DraftRepository } from '../../db/draft-repository.js';
import type { RosterRepository } from '../../db/roster-repository.js';
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
