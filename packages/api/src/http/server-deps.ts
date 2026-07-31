import type { AuthenticateHost } from '../auth/use-cases/authenticate-host.js';
import type { IssuePat } from '../auth/use-cases/issue-pat.js';
import type { RefreshSession } from '../auth/use-cases/refresh-session.js';
import type { AcceptInvitation } from '../auth/use-cases/accept-invitation.js';
import type { ClaimDeployment } from '../auth/use-cases/claim-deployment.js';
import type { InviteHost } from '../auth/use-cases/invite-host.js';
import type { ListHostAccounts } from '../auth/use-cases/list-host-accounts.js';
import type { ListInvitations } from '../auth/use-cases/list-invitations.js';
import type { OpenInvitation } from '../auth/use-cases/open-invitation.js';
import type { ResendInvitation } from '../auth/use-cases/resend-invitation.js';
import type { RevokeInvitation } from '../auth/use-cases/revoke-invitation.js';
import type { RegisterHost } from '../auth/use-cases/register-host.js';
import type { HostAccountRepository } from '../db/host-account-repository.js';
import type { Mailer } from '../mail/mailer.js';
import type { RevokePat } from '../auth/use-cases/revoke-pat.js';
import type { SignOutHost } from '../auth/use-cases/sign-out-host.js';
import type { SessionStore } from '../auth/session-store.js';
import type { TokenIssuer } from '../auth/token-issuer.js';
import type { AuditLogRepository } from '../db/audit-repository.js';
import type { ContestRepository } from '../db/contest-repository.js';
import type { DishRepository } from '../db/dish-repository.js';
import type { DraftRepository } from '../db/draft-repository.js';
import type { HostPatRepository } from '../db/host-pat-repository.js';
import type { RosterRepository } from '../db/roster-repository.js';
import type { VoteSessionRepository } from '../db/vote-session-repository.js';
import type { SubmitDish } from '../dishes/use-cases/submit-dish.js';
import type { GetBallot } from '../scoring/use-cases/get-ballot.js';
import type { GetMyScores } from '../scoring/use-cases/get-my-scores.js';
import type { SaveScore } from '../scoring/use-cases/save-score.js';
import type { SendVote } from '../scoring/use-cases/send-vote.js';
import type { CreateDraft } from '../drafts/use-cases/create-draft.js';
import type { ListHostDrafts } from '../drafts/use-cases/list-host-drafts.js';
import type { RenameDraft } from '../drafts/use-cases/rename-draft.js';
import type { AddDraftParticipant, RemoveDraftParticipant } from '../drafts/use-cases/manage-draft-participants.js';
import type { UpdateDraft } from '../drafts/use-cases/update-draft.js';
import type { ExtractContestDraft } from '../drafts/extraction/extract-contest-draft.js';
import type { MergeContestDraft } from '../drafts/extraction/merge-contest-draft.js';
import type { GetContest } from '../contests/use-cases/get-contest.js';
import type { FindContestsByName } from '../contests/use-cases/find-contests-by-name.js';
import type { GetContestDetails } from '../contests/use-cases/get-contest-details.js';
import type { ListMyContests } from '../contests/use-cases/list-my-contests.js';
import type { PublishContest } from '../contests/use-cases/publish-contest.js';
import type { CloseContest } from '../contests/use-cases/close-contest.js';
import type { RevealContest } from '../contests/use-cases/reveal-contest.js';
import type { GetResults } from '../contests/use-cases/get-results.js';
import type { DeleteContest } from '../contests/use-cases/delete-contest.js';
import type { CookieTransport } from './session-cookies.js';
import type { GetTally } from '../contests/use-cases/get-tally.js';
import type { GetTurnout } from '../contests/use-cases/get-turnout.js';
import type { SecurityEventLog } from '../security/security-event.js';
import type { ClaimPlace } from '../voters/use-cases/claim-place.js';
import type { Clock } from '../audit/audit-projection.js';
import type { LLMClient } from '@tapas/shared';

export interface SecurityConfig {
  readonly isProduction: boolean;
  /**
   * Explicitly a development environment. Distinct from `!isProduction` on
   * purpose: relaxations key off this, so an unset, misspelt or unfamiliar
   * environment (`staging`, say) stays hardened. The only way to soften anything
   * is to say `development` outright — the same rule the session cookie follows.
   */
  readonly isDevelopment: boolean;
  readonly allowedOrigins: readonly string[];
}

/** Everything the HTTP layer needs — assembled once at startup (or per test) and threaded into the routes. */
export interface ServerDeps {
  readonly tokens: TokenIssuer;
  readonly sessions: SessionStore;
  readonly registerHost: RegisterHost;
  readonly authenticateHost: AuthenticateHost;
  readonly refreshSession: RefreshSession;
  readonly signOutHost: SignOutHost;
  readonly createDraft: CreateDraft;
  readonly renameDraft: RenameDraft;
  readonly updateDraft: UpdateDraft;
  readonly addDraftParticipant: AddDraftParticipant;
  readonly removeDraftParticipant: RemoveDraftParticipant;
  readonly listHostDrafts: ListHostDrafts;
  readonly extractContestDraft: ExtractContestDraft;
  readonly mergeContestDraft: MergeContestDraft;
  readonly publishContest: PublishContest;
  readonly getContest: GetContest;
  readonly listMyContests: ListMyContests;
  readonly findContestsByName: FindContestsByName;
  readonly getContestDetails: GetContestDetails;
  readonly closeContest: CloseContest;
  readonly revealContest: RevealContest;
  readonly getResults: GetResults;
  readonly deleteContest: DeleteContest;
  /** How session cookies travel — derived from the environment (see cookieTransportFor). */
  readonly cookieTransport: CookieTransport;
  readonly getTally: GetTally;
  readonly getTurnout: GetTurnout;
  readonly clock: Clock;
  readonly drafts: DraftRepository;
  readonly contests: ContestRepository;
  readonly claimPlace: ClaimPlace;
  readonly roster: RosterRepository;
  readonly submitDish: SubmitDish;
  readonly dishes: DishRepository;
  readonly saveScore: SaveScore;
  readonly getMyScores: GetMyScores;
  readonly getBallot: GetBallot;
  readonly sendVote: SendVote;
  readonly voteSessions: VoteSessionRepository;
  readonly issuePat: IssuePat;
  readonly revokePat: RevokePat;
  readonly pats: HostPatRepository;
  readonly listHostAccounts: ListHostAccounts;
  readonly inviteHost: InviteHost;
  readonly openInvitation: OpenInvitation;
  readonly acceptInvitation: AcceptInvitation;
  readonly claimDeployment: ClaimDeployment;
  readonly listInvitations: ListInvitations;
  readonly revokeInvitation: RevokeInvitation;
  readonly resendInvitation: ResendInvitation;
  /** The system's one outbound side effect; in-memory until a real transport arrives. */
  readonly mailer: Mailer;
  /** Read by the administrative check, which takes the role from the store rather than the session. */
  readonly hostAccounts: HostAccountRepository;
  readonly securityLog: SecurityEventLog;
  readonly security: SecurityConfig;
  /** The audit log (a projection of domain events) — read for a contest's activity view. */
  readonly auditLog: AuditLogRepository;
  /** The LLM behind the in-app host assistant (same provider as draft extraction). */
  readonly llmClient: LLMClient;
  /** Secret keying the HMAC that gates the assistant's destructive actions (design.md §7.1). */
  readonly assistantConfirmationSecret: string;
}
