import { Navigate, Route, Routes } from 'react-router';
import { useTranslation } from 'react-i18next';
import './i18n'; // initialise i18next (sets the global instance used by useTranslation)
import { SignIn } from './pages/sign-in';
import { SignUp } from './pages/sign-up';
import { AcceptInvite } from './pages/accept-invite';
import { Claim } from './pages/claim';
import { Home } from './pages/home';
import { NewContest } from './pages/new-contest';
import { ReviewDraft } from './pages/review-draft';
import { Chat } from './pages/chat';
import { AuditLog } from './pages/audit-log';
import { ContestControl } from './pages/contest-control';
import { Results } from './pages/results';
import { useSession } from './auth/session';

/**
 * Host app routing, gated on the session. While the session is being checked we
 * hold with a quiet status (announced to assistive tech) rather than flashing
 * the wrong screen; then anonymous visitors land on sign-in and signed-in hosts
 * on home. A signed-in host visiting /sign-in is bounced home.
 */
export function App() {
  const { status, deploymentUnclaimed } = useSession();
  const { t } = useTranslation();

  if (status === 'loading') {
    return (
      <main id="main" style={{ padding: 28 }}>
        <p role="status">{t('common.loading')}</p>
      </main>
    );
  }

  const authed = status === 'authenticated';

  return (
    <Routes>
      {/* The app's one conditional redirect. Everything unrouted already funnels
          through /sign-in, so making this route aware covers the whole app — and
          /claim deliberately redirects nobody back, because two conditions
          reading server state at different moments disagree exactly while
          somebody is claiming, which a browser resolves by looping. */}
      <Route
        path="/sign-in"
        element={
          authed ? (
            <Navigate to="/" replace />
          ) : deploymentUnclaimed ? (
            <Navigate to="/claim" replace />
          ) : (
            <SignIn />
          )
        }
      />
      {/* `/accept-invite/:token` and `/claim`, clear of the proxied prefixes
          (/auth, /drafts, /contests, /assistant, /admin, /invites, /setup) — a
          browsable route under those is proxied to the API on a direct load or
          reload, which is exactly how an invitation link arrives. The API reads
          still use /invites/:token and /setup/admin. */}
      <Route path="/accept-invite/:token" element={<AcceptInvite />} />
      {/* No session guard, on purpose: this screen asks what the deployment is,
          not who the visitor is. On a deployment nobody has claimed there is
          nobody to be. */}
      <Route path="/claim" element={<Claim />} />
      <Route path="/sign-up" element={authed ? <Navigate to="/" replace /> : <SignUp />} />
      <Route path="/" element={authed ? <Home /> : <Navigate to="/sign-in" replace />} />
      <Route path="/new" element={authed ? <NewContest /> : <Navigate to="/sign-in" replace />} />
      {/* `/review/:id`, not `/drafts/:id`: the dev/preview proxy forwards
          `/drafts/*` to the API, so a browsable route there would be proxied
          away on a direct load or reload. The API reads still use `/drafts`. */}
      <Route
        path="/review/:id"
        element={authed ? <ReviewDraft /> : <Navigate to="/sign-in" replace />}
      />
      <Route path="/chat" element={authed ? <Chat /> : <Navigate to="/sign-in" replace />} />
      <Route path="/log/:id" element={authed ? <AuditLog /> : <Navigate to="/sign-in" replace />} />
      <Route path="/contest/:id" element={authed ? <ContestControl /> : <Navigate to="/sign-in" replace />} />
      {/* `/results/:id`, clear of the proxied prefixes (/auth, /drafts, /contests,
          /assistant) — a browsable route under those is proxied to the API on a
          direct load or reload. The API read still uses /contests/:id/winners. */}
      <Route path="/results/:id" element={authed ? <Results /> : <Navigate to="/sign-in" replace />} />
      <Route path="*" element={<Navigate to={authed ? '/' : '/sign-in'} replace />} />
    </Routes>
  );
}
