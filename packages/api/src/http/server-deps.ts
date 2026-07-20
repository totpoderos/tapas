import type { AuthenticateHost } from '../auth/use-cases/authenticate-host.js';
import type { IssuePat } from '../auth/use-cases/issue-pat.js';
import type { RefreshSession } from '../auth/use-cases/refresh-session.js';
import type { RegisterHost } from '../auth/use-cases/register-host.js';
import type { RevokePat } from '../auth/use-cases/revoke-pat.js';
import type { SignOutHost } from '../auth/use-cases/sign-out-host.js';
import type { SessionStore } from '../auth/session-store.js';
import type { TokenIssuer } from '../auth/token-issuer.js';
import type { ContestRepository } from '../db/contest-repository.js';
import type { DraftRepository } from '../db/draft-repository.js';
import type { HostPatRepository } from '../db/host-pat-repository.js';
import type { RosterRepository } from '../db/roster-repository.js';
import type { CreateDraft } from '../drafts/use-cases/create-draft.js';
import type { DiscardDraft } from '../drafts/use-cases/discard-draft.js';
import type { ListHostDrafts } from '../drafts/use-cases/list-host-drafts.js';
import type { RenameDraft } from '../drafts/use-cases/rename-draft.js';
import type { GetContest } from '../contests/use-cases/get-contest.js';
import type { PublishContest } from '../contests/use-cases/publish-contest.js';
import type { SecurityEventLog } from '../security/security-event.js';
import type { ClaimPlace } from '../voters/use-cases/claim-place.js';

export interface SecurityConfig {
  readonly isProduction: boolean;
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
  readonly discardDraft: DiscardDraft;
  readonly listHostDrafts: ListHostDrafts;
  readonly publishContest: PublishContest;
  readonly getContest: GetContest;
  readonly drafts: DraftRepository;
  readonly contests: ContestRepository;
  readonly claimPlace: ClaimPlace;
  readonly roster: RosterRepository;
  readonly issuePat: IssuePat;
  readonly revokePat: RevokePat;
  readonly pats: HostPatRepository;
  readonly securityLog: SecurityEventLog;
  readonly security: SecurityConfig;
}
