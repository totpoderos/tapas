import { Navigate, Route, Routes } from 'react-router-dom';
import { SignIn } from './pages/sign-in';
import { SignUp } from './pages/sign-up';
import { Home } from './pages/home';
import { NewContest } from './pages/new-contest';
import { useSession } from './auth/session';

/**
 * Host app routing, gated on the session. While the session is being checked we
 * hold with a quiet status (announced to assistive tech) rather than flashing
 * the wrong screen; then anonymous visitors land on sign-in and signed-in hosts
 * on home. A signed-in host visiting /sign-in is bounced home.
 */
export function App() {
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <main id="main" style={{ padding: 28 }}>
        <p role="status">Loading…</p>
      </main>
    );
  }

  const authed = status === 'authenticated';

  return (
    <Routes>
      <Route path="/sign-in" element={authed ? <Navigate to="/" replace /> : <SignIn />} />
      <Route path="/sign-up" element={authed ? <Navigate to="/" replace /> : <SignUp />} />
      <Route path="/" element={authed ? <Home /> : <Navigate to="/sign-in" replace />} />
      <Route path="/new" element={authed ? <NewContest /> : <Navigate to="/sign-in" replace />} />
      <Route path="*" element={<Navigate to={authed ? '/' : '/sign-in'} replace />} />
    </Routes>
  );
}
