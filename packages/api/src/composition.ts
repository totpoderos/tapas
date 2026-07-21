import type { DatabaseSync } from 'node:sqlite';
import type { Env } from './config/env.js';
import type { Clock } from './audit/audit-projection.js';
import { createAuditProjection } from './audit/audit-projection.js';
import { AuditRecorder } from './audit/audit-recorder.js';
import { SqliteAuditLogRepository } from './db/audit-repository.js';
import { SqliteContestRepository } from './db/contest-repository.js';
import { SqliteDraftRepository } from './db/draft-repository.js';
import { SqliteHostAccountRepository } from './db/host-account-repository.js';
import { SqliteHostPatRepository } from './db/host-pat-repository.js';
import { SqliteDishRepository } from './db/dish-repository.js';
import { SqliteRosterRepository } from './db/roster-repository.js';
import { SqliteSecurityEventLog } from './db/security-event-repository.js';
import { SqliteSessionStore } from './db/session-repository.js';
import { BcryptPasswordHasher, type PasswordHasher } from './auth/password-hasher.js';
import { HmacJwtTokenIssuer } from './auth/token-issuer.js';
import { AuthenticateHost } from './auth/use-cases/authenticate-host.js';
import { IssuePat } from './auth/use-cases/issue-pat.js';
import { RefreshSession } from './auth/use-cases/refresh-session.js';
import { RegisterHost } from './auth/use-cases/register-host.js';
import { RevokePat } from './auth/use-cases/revoke-pat.js';
import { SignOutHost } from './auth/use-cases/sign-out-host.js';
import { CreateDraft } from './drafts/use-cases/create-draft.js';
import { DiscardDraft } from './drafts/use-cases/discard-draft.js';
import { ListHostDrafts } from './drafts/use-cases/list-host-drafts.js';
import { RenameDraft } from './drafts/use-cases/rename-draft.js';
import { GetContest } from './contests/use-cases/get-contest.js';
import { PublishContest } from './contests/use-cases/publish-contest.js';
import { RandomJoinCodeGenerator } from './contests/join-code-generator.js';
import { SubmitDish } from './dishes/use-cases/submit-dish.js';
import { ClaimPlace } from './voters/use-cases/claim-place.js';
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
  const roster = new SqliteRosterRepository(db);
  const dishes = new SqliteDishRepository(db);
  const pats = new SqliteHostPatRepository(db);
  const auditLog = new SqliteAuditLogRepository(db);
  const audit = new AuditRecorder(auditLog, createAuditProjection({ clock, ids }));
  const securityLog = new SqliteSecurityEventLog(db, clock, ids);

  const tokens = new HmacJwtTokenIssuer(env.JWT_SECRET, clock);

  return {
    tokens,
    sessions,
    registerHost: new RegisterHost({ accounts, hasher, ids }),
    authenticateHost: new AuthenticateHost({ accounts, hasher, tokens, sessions, clock }),
    refreshSession: new RefreshSession({ tokens, sessions, clock }),
    signOutHost: new SignOutHost({ tokens, sessions }),
    createDraft: new CreateDraft({ drafts, audit, clock, ids }),
    renameDraft: new RenameDraft({ drafts, audit, clock, ids }),
    discardDraft: new DiscardDraft({ drafts, audit, clock, ids }),
    listHostDrafts: new ListHostDrafts(drafts),
    publishContest: new PublishContest({
      drafts,
      contests,
      roster,
      audit,
      clock,
      joinCodes: new RandomJoinCodeGenerator(),
    }),
    getContest: new GetContest(contests),
    drafts,
    contests,
    claimPlace: new ClaimPlace({ contests, roster, tokens, clock }),
    roster,
    submitDish: new SubmitDish({ contests, dishes, clock }),
    dishes,
    issuePat: new IssuePat({ pats, ids, clock }),
    revokePat: new RevokePat({ pats }),
    pats,
    securityLog,
    security: {
      isProduction: env.NODE_ENV === 'production',
      allowedOrigins: [env.HOST_WEB_ORIGIN, env.PARTICIPANT_WEB_ORIGIN],
    },
  };
}
