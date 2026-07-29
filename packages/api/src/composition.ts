import type { DatabaseSync } from 'node:sqlite';
import type { LLMClient } from '@tapas/shared';
import type { Env } from './config/env.js';
import type { Clock } from './audit/audit-projection.js';
import { KeywordStubLLMClient } from './llm/keyword-stub-llm-client.js';
import { OpenAiCompatibleLLMClient } from './llm/openai-compatible-llm-client.js';
import { ExtractContestDraft } from './drafts/extraction/extract-contest-draft.js';
import { MergeContestDraft } from './drafts/extraction/merge-contest-draft.js';
import { createAuditProjection } from './audit/audit-projection.js';
import { AuditRecorder } from './audit/audit-recorder.js';
import { SqliteAuditLogRepository } from './db/audit-repository.js';
import { SqliteContestRepository } from './db/contest-repository.js';
import { SqliteDraftRepository } from './db/draft-repository.js';
import { SqliteHostAccountRepository } from './db/host-account-repository.js';
import { SqliteHostPatRepository } from './db/host-pat-repository.js';
import { SqliteDishRepository } from './db/dish-repository.js';
import { SqliteRosterRepository } from './db/roster-repository.js';
import { SqliteVoteSessionRepository } from './db/vote-session-repository.js';
import { SqliteSecurityEventLog } from './db/security-event-repository.js';
import { SqliteSessionStore } from './db/session-repository.js';
import { BcryptPasswordHasher, type PasswordHasher } from './auth/password-hasher.js';
import { HmacJwtTokenIssuer } from './auth/token-issuer.js';
import { AuthenticateHost } from './auth/use-cases/authenticate-host.js';
import { IssuePat } from './auth/use-cases/issue-pat.js';
import { RefreshSession } from './auth/use-cases/refresh-session.js';
import { AcceptInvitation } from './auth/use-cases/accept-invitation.js';
import { InviteHost } from './auth/use-cases/invite-host.js';
import { ListHostAccounts } from './auth/use-cases/list-host-accounts.js';
import { ListInvitations } from './auth/use-cases/list-invitations.js';
import { OpenInvitation } from './auth/use-cases/open-invitation.js';
import { ResendInvitation } from './auth/use-cases/resend-invitation.js';
import { RevokeInvitation } from './auth/use-cases/revoke-invitation.js';
import { RegisterHost } from './auth/use-cases/register-host.js';
import { SqliteHostInvitationRepository } from './db/host-invitation-repository.js';
import { InMemoryMailer } from './mail/mailer.js';
import { RevokePat } from './auth/use-cases/revoke-pat.js';
import { SignOutHost } from './auth/use-cases/sign-out-host.js';
import { CreateDraft } from './drafts/use-cases/create-draft.js';
import { ListHostDrafts } from './drafts/use-cases/list-host-drafts.js';
import { RenameDraft } from './drafts/use-cases/rename-draft.js';
import { AddDraftParticipant, RemoveDraftParticipant } from './drafts/use-cases/manage-draft-participants.js';
import { UpdateDraft } from './drafts/use-cases/update-draft.js';
import { FindContestsByName } from './contests/use-cases/find-contests-by-name.js';
import { GetContestDetails } from './contests/use-cases/get-contest-details.js';
import { GetContest } from './contests/use-cases/get-contest.js';
import { ListMyContests } from './contests/use-cases/list-my-contests.js';
import { PublishContest } from './contests/use-cases/publish-contest.js';
import { CloseContest } from './contests/use-cases/close-contest.js';
import { RevealContest } from './contests/use-cases/reveal-contest.js';
import { GetResults } from './contests/use-cases/get-results.js';
import { DeleteContest } from './contests/use-cases/delete-contest.js';
import { SqliteUnitOfWork } from './db/unit-of-work.js';
import { cookieTransportFor } from './http/session-cookies.js';
import { GetTally } from './contests/use-cases/get-tally.js';
import { RandomJoinCodeGenerator } from './contests/join-code-generator.js';
import { SubmitDish } from './dishes/use-cases/submit-dish.js';
import { GetBallot } from './scoring/use-cases/get-ballot.js';
import { GetMyScores } from './scoring/use-cases/get-my-scores.js';
import { SaveScore } from './scoring/use-cases/save-score.js';
import { SendVote } from './scoring/use-cases/send-vote.js';
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
  llmClient: LLMClient = env.ASSISTANT_STUB === 1
    ? new KeywordStubLLMClient()
    : new OpenAiCompatibleLLMClient({
        baseUrl: env.LLM_BASE_URL,
        apiKey: env.LLM_API_KEY,
        model: env.LLM_MODEL,
      }),
): ServerDeps {
  const ids = new UuidIdGenerator();

  const accounts = new SqliteHostAccountRepository(db);
  const sessions = new SqliteSessionStore(db);
  const drafts = new SqliteDraftRepository(db);
  const contests = new SqliteContestRepository(db);
  const roster = new SqliteRosterRepository(db);
  const dishes = new SqliteDishRepository(db);
  const voteSessions = new SqliteVoteSessionRepository(db, clock);
  const pats = new SqliteHostPatRepository(db);
  const auditLog = new SqliteAuditLogRepository(db);
  const audit = new AuditRecorder(auditLog, createAuditProjection({ clock, ids }));
  const securityLog = new SqliteSecurityEventLog(db, clock, ids);

  const tokens = new HmacJwtTokenIssuer(env.JWT_SECRET, clock);

  const invitations = new SqliteHostInvitationRepository(db);
  const mailer = new InMemoryMailer();
  const registerHost = new RegisterHost({ accounts, hasher, ids });
  // The acceptance page is a host-app route, not an API one — the link points at
  // the frontend, which reads the token and calls back here.
  const invitationLinkBase = `${env.HOST_WEB_ORIGIN}/accept-invite`;
  const inviteHost = new InviteHost({
    invitations,
    accounts,
    mailer,
    ids,
    clock,
    linkBase: invitationLinkBase,
  });

  return {
    tokens,
    sessions,
    registerHost,
    authenticateHost: new AuthenticateHost({ accounts, hasher, tokens, sessions, clock }),
    refreshSession: new RefreshSession({ tokens, sessions, clock }),
    signOutHost: new SignOutHost({ tokens, sessions }),
    createDraft: new CreateDraft({ drafts, audit, clock, ids }),
    renameDraft: new RenameDraft({ drafts, audit, clock, ids }),
    updateDraft: new UpdateDraft({ drafts, audit, clock, ids }),
    addDraftParticipant: new AddDraftParticipant({
      findContestsByName: new FindContestsByName(new ListMyContests({ drafts, contests })),
      drafts,
      updateDraft: new UpdateDraft({ drafts, audit, clock, ids }),
      ids,
    }),
    removeDraftParticipant: new RemoveDraftParticipant({
      findContestsByName: new FindContestsByName(new ListMyContests({ drafts, contests })),
      drafts,
      updateDraft: new UpdateDraft({ drafts, audit, clock, ids }),
      ids,
    }),
    listHostDrafts: new ListHostDrafts(drafts),
    extractContestDraft: new ExtractContestDraft({ llmClient }),
    mergeContestDraft: new MergeContestDraft({ llmClient }),
    publishContest: new PublishContest({
      drafts,
      contests,
      roster,
      audit,
      clock,
      joinCodes: new RandomJoinCodeGenerator(),
    }),
    getContest: new GetContest(contests),
    listMyContests: new ListMyContests({ drafts, contests }),
    findContestsByName: new FindContestsByName(new ListMyContests({ drafts, contests })),
    getContestDetails: new GetContestDetails({
      findContestsByName: new FindContestsByName(new ListMyContests({ drafts, contests })),
      drafts,
      contests,
      roster,
    }),
    closeContest: new CloseContest({ contests, clock, audit }),
    revealContest: new RevealContest({ contests, clock, audit }),
    cookieTransport: cookieTransportFor(env.NODE_ENV),
    getResults: new GetResults({ contests, voteSessions }),
    deleteContest: new DeleteContest({
      contests,
      drafts,
      roster,
      dishes,
      voteSessions,
      audit,
      unitOfWork: new SqliteUnitOfWork(db),
    }),
    getTally: new GetTally({ contests, roster, voteSessions }),
    clock,
    drafts,
    contests,
    claimPlace: new ClaimPlace({ contests, roster, tokens, clock }),
    roster,
    submitDish: new SubmitDish({ contests, dishes, clock }),
    dishes,
    saveScore: new SaveScore({ contests, voteSessions, ids, clock }),
    getMyScores: new GetMyScores({ voteSessions }),
    getBallot: new GetBallot({ contests, dishes }),
    sendVote: new SendVote({ contests, voteSessions, roster, clock }),
    voteSessions,
    issuePat: new IssuePat({ pats, ids, clock }),
    revokePat: new RevokePat({ pats }),
    pats,
    listHostAccounts: new ListHostAccounts({ hostAccounts: accounts }),
    inviteHost,
    openInvitation: new OpenInvitation({ invitations, clock }),
    acceptInvitation: new AcceptInvitation({ invitations, registerHost, clock }),
    listInvitations: new ListInvitations({ invitations, clock }),
    revokeInvitation: new RevokeInvitation({ invitations, clock }),
    resendInvitation: new ResendInvitation({ invitations, inviteHost }),
    mailer,
    hostAccounts: accounts,
    securityLog,
    security: {
      isProduction: env.NODE_ENV === 'production',
      isDevelopment: env.NODE_ENV === 'development',
      allowedOrigins: [env.HOST_WEB_ORIGIN, env.PARTICIPANT_WEB_ORIGIN],
    },
    auditLog,
    llmClient,
    assistantConfirmationSecret: env.ASSISTANT_CONFIRMATION_SECRET,
  };
}
