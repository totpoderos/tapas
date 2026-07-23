import { useState, type FormEvent } from 'react';
import { Button, FormField } from '@tapas/ui';
import { ApiError } from '../api/client';
import { useSession } from '../auth/session';
import styles from './auth.module.css';

/**
 * Host sign-in (design system "Host sign-in"). A real <form> so Enter submits
 * and the flow is keyboard-operable; the primary button is the form's submit.
 * Bad credentials surface inline and announced (`role="alert"`), never a dead
 * end — the host stays on the page to try again.
 */
export function SignIn() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setSubmitting(true);
    try {
      await signIn(email, password);
      // On success the session flips to authenticated and the router shows home.
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 401
          ? 'That email and password don’t match. Check them and try again.'
          : 'Something went wrong signing you in. Please try again.',
      );
      setSubmitting(false);
    }
  }

  return (
    <main id="main" className={styles.page}>
      <div className={styles.card}>
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <div className={styles.brand}>
            <span className={styles.dot} aria-hidden="true" />
            <b>Tapas</b>
          </div>
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.sub}>Sign in to run your contests.</p>

          {error ? (
            <div className={styles.alert} role="alert">
              <span aria-hidden="true">✕</span>
              <span>{error}</span>
            </div>
          ) : null}

          <div className={styles.fields}>
            <FormField
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <FormField
              id="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" block disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
            <p className={styles.foot}>
              New here? <a href="/sign-up">Create a host account</a>
            </p>
          </div>
        </form>

        <aside className={styles.panel} aria-label="Tonight">
          <div className={styles.stripe} aria-hidden="true" />
          <div className={styles.content}>
            <p className={styles.kicker}>Tonight</p>
            <div className={styles.contest}>Sobremesa Summer 2026</div>
            <p className={styles.detail}>
              16 cooks · 3 categories · scoring opens 20:30. The room is filling up.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
