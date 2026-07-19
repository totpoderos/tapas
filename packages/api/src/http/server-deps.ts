import type { AuthenticateHost } from '../auth/use-cases/authenticate-host.js';
import type { RefreshSession } from '../auth/use-cases/refresh-session.js';
import type { RegisterHost } from '../auth/use-cases/register-host.js';
import type { SignOutHost } from '../auth/use-cases/sign-out-host.js';
import type { SessionStore } from '../auth/session-store.js';
import type { TokenIssuer } from '../auth/token-issuer.js';
import type { DraftRepository } from '../db/draft-repository.js';
import type { CreateDraft } from '../drafts/use-cases/create-draft.js';
import type { CookieOptions } from './session-cookies.js';

/** Everything the HTTP layer needs — assembled once at startup (or per test) and threaded into the routes. */
export interface ServerDeps {
  readonly tokens: TokenIssuer;
  readonly sessions: SessionStore;
  readonly registerHost: RegisterHost;
  readonly authenticateHost: AuthenticateHost;
  readonly refreshSession: RefreshSession;
  readonly signOutHost: SignOutHost;
  readonly createDraft: CreateDraft;
  readonly drafts: DraftRepository;
  readonly cookies: CookieOptions;
}
