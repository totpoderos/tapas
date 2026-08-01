import { Navigate, Route, Routes } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import './i18n'; // initialise i18next (sets the global instance used by useTranslation)
import { SignIn } from './pages/sign-in';
import { AcceptInvite } from './pages/accept-invite';
import { Claim } from './pages/claim';
import { People } from './pages/people';
import { Home } from './pages/home';
import { NewContest } from './pages/new-contest';
import { DraftWorkspace } from './pages/draft/draft-workspace';
import { DraftRules } from './pages/draft/draft-rules';
import { DraftParticipants } from './pages/draft/draft-participants';
import { Chat } from './pages/chat';
import { AuditLog } from './pages/audit-log';
import { ContestControl } from './pages/contest-control';
import { Results } from './pages/results';
import { useSession } from './auth/session';
import { ContestsProvider } from './contests/contests-provider';
import { PanelShell } from './shell/panel-shell';

/**
 * Host app routing, gated on the session. While the session is being checked we
 * hold with a quiet status (announced to assistive tech) rather than flashing
 * the wrong screen; then anonymous visitors land on sign-in and signed-in hosts
 * on home. A signed-in host visiting /sign-in is bounced home.
 */
export function App() {
  const { status, isAdministrator } = useSession();
  const { t } = useTranslation();

  if (status === 'loading') {
    return (
      <main id="main" style={{ padding: 28 }}>
        <p role="status">{t('common.loading')}</p>
      </main>
    );
  }

  const authed = status === 'authenticated';

  /**
   * A signed-in screen, inside the panel. The contest list is provided for a
   * host's navigation, which counts and names their contests, and withheld from an
   * administrator's, which draws none — so their panel never asks for a list it
   * would not show.
   */
  const panel = (surface: ReactNode) => {
    if (!authed) return <Navigate to="/sign-in" replace />;
    if (isAdministrator) return <PanelShell>{surface}</PanelShell>;
    return (
      <ContestsProvider>
        <PanelShell>{surface}</PanelShell>
      </ContestsProvider>
    );
  };

  /**
   * A host surface. The two kinds of work do not mix, so this is not somewhere an
   * administrator can be: they are sent to the people instead. That is a decision
   * about where work is done in the panel, not about what an account may do — the
   * API still decides on every request, and an administrator keeps a host's powers
   * there.
   */
  const host = (surface: ReactNode) =>
    authed && isAdministrator ? <Navigate to="/people" replace /> : panel(surface);

  return (
    <Routes>
      {/* Sign-in is never redirected away from, even on a deployment nobody has
          claimed. It carries a way through to /claim instead. An earlier version
          did redirect, and it locked out every host on a deployment that has
          accounts but no administrator — which is every deployment until open
          registration is removed, and is exactly what the browser suite found. */}
      <Route path="/sign-in" element={authed ? <Navigate to="/" replace /> : <SignIn />} />
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
      {/* `/` is the contest list for a host and the people for an administrator:
          the panel's front door is whichever workspace theirs is. */}
      <Route path="/" element={host(<Home />)} />
      <Route path="/new" element={host(<NewContest />)} />
      {/* `/review/:id`, not `/drafts/:id`: the dev/preview proxy forwards
          `/drafts/*` to the API, so a browsable route there would be proxied
          away on a direct load or reload. The API reads still use `/drafts`.

          A layout route with two children: a contest being prepared is settled in
          two sections, and the workspace above them holds the draft so moving
          between them costs nothing. The rules are the index, so every existing
          link to `/review/:id` — the contest list, the assistant, the redirect
          after saving a new contest — keeps working and lands on them. */}
      <Route path="/review/:id" element={host(<DraftWorkspace />)}>
        <Route index element={<DraftRules />} />
        <Route path="people" element={<DraftParticipants />} />
      </Route>
      {/* `/people`, not `/admin`: that prefix forwards to the API, as `/invites`
          and `/setup` do, so a browsable route there would be proxied away on a
          direct load or reload. No role guard here on purpose — the server
          decides, and the screen renders what it is told, including being told
          no, so a host who arrives is told plainly rather than moved. They keep
          their own navigation while they are told: being here is not a role. */}
      <Route path="/people" element={panel(<People />)} />
      <Route path="/chat" element={host(<Chat />)} />
      <Route path="/log/:id" element={host(<AuditLog />)} />
      <Route path="/contest/:id" element={host(<ContestControl />)} />
      {/* `/results/:id`, clear of the proxied prefixes (/auth, /drafts, /contests,
          /assistant) — a browsable route under those is proxied to the API on a
          direct load or reload. The API read still uses /contests/:id/winners. */}
      <Route path="/results/:id" element={host(<Results />)} />
      <Route path="*" element={<Navigate to={authed ? '/' : '/sign-in'} replace />} />
    </Routes>
  );
}
