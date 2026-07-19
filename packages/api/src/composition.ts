import type { DatabaseSync } from 'node:sqlite';
import type { Env } from './config/env.js';
import type { Clock } from './audit/audit-projection.js';
import { createAuditProjection } from './audit/audit-projection.js';
import { AuditRecorder } from './audit/audit-recorder.js';
import { SqliteAuditLogRepository } from './db/audit-repository.js';
import { SqliteContestRepository } from './db/contest-repository.js';
import { SqliteDraftRepository } from './db/draft-repository.js';
import { SqliteHostAccountRepository } from './db/host-account-repository.js';
import { SqliteSessionStore } from './db/session-repository.js';
import { SqliteVoterRepository } from './db/voter-repository.js';
import { BcryptPasswordHasher, type PasswordHasher } from './auth/password-hasher.js';
import { HmacJwtTokenIssuer } from './auth/token-issuer.js';
import { AuthenticateHost } from './auth/use-cases/authenticate-host.js';
import { RefreshSession } from './auth/use-cases/refresh-session.js';
import { RegisterHost } from './auth/use-cases/register-host.js';
import { SignOutHost } from './auth/use-cases/sign-out-host.js';
import { CreateDraft } from './drafts/use-cases/create-draft.js';
import { JoinContest } from './voters/use-cases/join-contest.js';
import type { ServerDeps } from './http/server-deps.js';
import { SystemClock, UuidIdGenerator } from './runtime.js';

const BCRYPT_COST = 12;

/** Assembles the production `ServerDeps` from a real SQLite connection and validated env. */
export function buildProductionDeps(
  db: DatabaseSync,
  env: Env,
  clock: Clock = new SystemClock(),
  hasher: PasswordHasher = new BcryptPasswordHasher(BCRYPT_COST),
): ServerDeps {
  const ids = new UuidIdGenerator();

  const accounts = new SqliteHostAccountRepository(db);
  const sessions = new SqliteSessionStore(db);
  const drafts = new SqliteDraftRepository(db);
  const contests = new SqliteContestRepository(db);
  const voters = new SqliteVoterRepository(db);
  const auditLog = new SqliteAuditLogRepository(db);
  const audit = new AuditRecorder(auditLog, createAuditProjection({ clock, ids }));

  const tokens = new HmacJwtTokenIssuer(env.JWT_SECRET, clock);

  return {
    tokens,
    sessions,
    registerHost: new RegisterHost({ accounts, hasher, ids }),
    authenticateHost: new AuthenticateHost({ accounts, hasher, tokens, sessions, clock }),
    refreshSession: new RefreshSession({ tokens, sessions, clock }),
    signOutHost: new SignOutHost({ tokens, sessions }),
    createDraft: new CreateDraft({ drafts, audit, clock, ids }),
    drafts,
    joinContest: new JoinContest({ contests, voters, tokens, ids, clock }),
    voters,
    cookies: { secure: env.NODE_ENV === 'production' },
  };
}
