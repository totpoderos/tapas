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
export {
  DraftService,
  type DraftServiceDeps,
  type DraftResult,
  type DiscardResult,
  type DraftError,
  type DraftErrorCode,
} from './drafts/draft-service.js';
