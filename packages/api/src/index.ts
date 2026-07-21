export { buildServer, type ServerDeps } from './server.js';
export { buildProductionDeps } from './composition.js';
export { loadEnv, EnvValidationError, type Env } from './config/env.js';
export { openDatabase, runMigrations } from './db/migrate.js';
export {
  createAuditProjection,
  type AuditProjection,
  type AuditContext,
  type Clock,
  type IdGenerator,
} from './audit/audit-projection.js';
export { AuditRecorder } from './audit/audit-recorder.js';
export { SystemClock, UuidIdGenerator } from './runtime.js';

export { SqliteDraftRepository, type DraftRepository } from './db/draft-repository.js';
export { SqliteAuditLogRepository, type AuditLogRepository } from './db/audit-repository.js';

export type { StoredDraft } from './drafts/stored-draft.js';
export { CreateDraft } from './drafts/use-cases/create-draft.js';
export { RenameDraft } from './drafts/use-cases/rename-draft.js';
export { DiscardDraft } from './drafts/use-cases/discard-draft.js';
export { GetDraft } from './drafts/use-cases/get-draft.js';
export { ListHostDrafts } from './drafts/use-cases/list-host-drafts.js';
export type {
  DraftUseCaseDeps,
  DraftWriteResult,
  DiscardResult,
  DraftFailure,
  DraftFailureCode,
} from './drafts/use-cases/shared.js';

export { SqliteContestRepository, type ContestRepository } from './db/contest-repository.js';
export type { StoredContest } from './contests/stored-contest.js';
export { RandomJoinCodeGenerator, type JoinCodeGenerator } from './contests/join-code-generator.js';
export { serializeMaterialized, deserializeMaterialized } from './contests/materialized-codec.js';
export { PublishContest } from './contests/use-cases/publish-contest.js';
export { GetContest } from './contests/use-cases/get-contest.js';
export { CloseContest } from './contests/use-cases/close-contest.js';
export type {
  PublishContestDeps,
  PublishContestResult,
  PublishFailure,
  PublishFailureCode,
  CloseContestDeps,
  CloseContestResult,
  CloseContestError,
  CloseContestErrorCode,
} from './contests/use-cases/shared.js';
export { ensureContestFresh } from './contests/ensure-fresh.js';
export type { EnsureContestFreshDeps } from './contests/ensure-fresh.js';

export { BcryptPasswordHasher, type PasswordHasher } from './auth/password-hasher.js';
export {
  HmacJwtTokenIssuer,
  ACCESS_TTL_SECONDS,
  REFRESH_TTL_SECONDS,
  type TokenIssuer,
  type Session,
  type TokenClaims,
  type VerifiedClaims,
} from './auth/token-issuer.js';
export {
  SqliteHostAccountRepository,
  type HostAccountRepository,
} from './db/host-account-repository.js';
export { RegisterHost, type RegisterHostDeps } from './auth/use-cases/register-host.js';
export { AuthenticateHost, type AuthenticateHostDeps } from './auth/use-cases/authenticate-host.js';
export { RefreshSession, type RefreshSessionDeps } from './auth/use-cases/refresh-session.js';
export { SignOutHost, type SignOutHostDeps } from './auth/use-cases/sign-out-host.js';
export type {
  RegisterResult,
  RegisterError,
  RegisterErrorCode,
  AuthResult,
  AuthError,
  AuthErrorCode,
  AuthLogReason,
  RefreshResult,
  RefreshError,
  RefreshErrorCode,
} from './auth/use-cases/shared.js';
export type { SessionStore } from './auth/session-store.js';
export { SqliteSessionStore } from './db/session-repository.js';

export type {
  SecurityEvent,
  SecurityEventInput,
  SecurityEventType,
  SecurityEventLog,
} from './security/security-event.js';
export { SqliteSecurityEventLog } from './db/security-event-repository.js';

export {
  SqliteVoteSessionRepository,
  type VoteSessionRepository,
} from './db/vote-session-repository.js';
export type { StoredVoteSession, StoredScore } from './scoring/stored-vote-session.js';
export { SaveScore, type SaveScoreDeps } from './scoring/use-cases/save-score.js';
export { GetMyScores, type GetMyScoresDeps } from './scoring/use-cases/get-my-scores.js';
export { SendVote, type SendVoteDeps } from './scoring/use-cases/send-vote.js';
export type {
  SaveScoreResult,
  SaveScoreError,
  SaveScoreErrorCode,
  SendVoteResult,
  SendVoteError,
  SendVoteErrorCode,
} from './scoring/use-cases/shared.js';

export { SqliteDishRepository, type DishRepository } from './db/dish-repository.js';
export type { StoredDish } from './dishes/stored-dish.js';
export {
  SubmitDish,
  type SubmitDishDeps,
  type SubmitDishInput,
} from './dishes/use-cases/submit-dish.js';
export type {
  SubmitDishResult,
  SubmitDishError,
  SubmitDishErrorCode,
} from './dishes/use-cases/shared.js';

export {
  SqliteRosterRepository,
  type RosterRepository,
  type RosterSeed,
} from './db/roster-repository.js';
export type { RosterPlace } from './voters/roster-place.js';
export { ClaimPlace, type ClaimPlaceDeps } from './voters/use-cases/claim-place.js';
export type { ClaimResult, ClaimError, ClaimErrorCode } from './voters/use-cases/shared.js';

export { SqliteHostPatRepository, type HostPatRepository } from './db/host-pat-repository.js';
export type { StoredHostPat } from './auth/stored-host-pat.js';
export { generatePatToken, hashPatToken } from './auth/pat-hasher.js';
export { IssuePat, type IssuePatDeps } from './auth/use-cases/issue-pat.js';
export { RevokePat, type RevokePatDeps } from './auth/use-cases/revoke-pat.js';
export type {
  IssuePatResult,
  RevokePatResult,
  RevokePatError,
  RevokePatErrorCode,
} from './auth/use-cases/pat-shared.js';
