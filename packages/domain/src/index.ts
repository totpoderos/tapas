export type { DomainEvent } from './events/domain-event.js';
export { SYSTEM_ACTOR } from './events/domain-event.js';

export type {
  Attribution,
  AntiBias,
  Category,
  CategoryId,
  ContestDraft,
  DishId,
  MaterializedContest,
  MaterializedDish,
  Person,
  PersonId,
  ScoreBounds,
  ScoreRange,
  ScoringConfig,
} from './model.js';

export { compile } from './compile.js';
export type { CompileError, CompileErrorCode, CompileResult } from './compile.js';

export { Draft } from './draft/draft.js';
export type { DraftResult, DraftInvariantError } from './draft/draft.js';
export type { DraftContent, CloseRule, RevealStrategy } from './draft/draft-content.js';

export { Contest } from './contest/contest.js';
export type {
  PublishResult,
  PublishError,
  PublishErrorCode,
  PublishableDraft,
} from './contest/contest.js';

export { Email } from './auth/email.js';
export type { EmailResult, EmailError } from './auth/email.js';
export { checkPasswordStrength, MIN_PASSWORD_LENGTH } from './auth/password-policy.js';
export type { PasswordWeakness } from './auth/password-policy.js';
export { HostAccount, MAX_FAILED_ATTEMPTS, LOCK_DURATION_MINUTES } from './auth/host-account.js';
export type { HostRole } from './auth/host-account.js';

export { checkScore } from './scoring/score-check.js';
export type {
  ScoreCheckResult,
  ScoreCheckError,
  ScoreCheckErrorCode,
  ScoreInput,
} from './scoring/score-check.js';
export { VoteSession } from './scoring/vote-session.js';
export type {
  VoteSessionStatus,
  VoteSessionErrorCode,
  VoteSessionError,
  SendResult,
} from './scoring/vote-session.js';
