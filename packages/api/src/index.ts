export { buildServer } from './server.js';
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
export type {
  PublishContestDeps,
  PublishContestResult,
  PublishFailure,
  PublishFailureCode,
} from './contests/use-cases/shared.js';

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
export { SqliteHostAccountRepository, type HostAccountRepository } from './db/host-account-repository.js';
export { RegisterHost, type RegisterHostDeps } from './auth/use-cases/register-host.js';
export { AuthenticateHost, type AuthenticateHostDeps } from './auth/use-cases/authenticate-host.js';
export type {
  RegisterResult,
  RegisterError,
  RegisterErrorCode,
  AuthResult,
  AuthError,
  AuthErrorCode,
} from './auth/use-cases/shared.js';
