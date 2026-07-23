import { useState, type FormEvent } from 'react';
import { Button, FormField } from '@tapas/ui';
import { ApiError } from '../api/client';
import { useSession } from '../auth/session';
import styles from './auth.module.css';

const PASSWORD_HINT = 'At least 12 characters, with upper- and lower-case, a number, and a symbol.';

/**
 * Host sign-up (design system "Host sign-in/up"). Creates the account and signs
 * the host straight in. The API is the authority on the password policy and
 * duplicate emails; its errors are surfaced where the host can act on them — a
 * weak password or malformed email on the field itself (announced), a taken
 * email as a form-level notice pointing at sign-in.
 */
export function SignUp() {
  const { signUp } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setEmailError(undefined);
    setPasswordError(undefined);
    setFormError(undefined);
    setSubmitting(true);
    try {
      await signUp(email, password);
      // Session flips to authenticated and the router shows home.
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : undefined;
      if (code === 'EMAIL_TAKEN') {
        setFormError('That email is already registered. Try signing in instead.');
      } else if (code === 'INVALID_EMAIL') {
        setEmailError('Enter a valid email address.');
      } else if (code === 'WEAK_PASSWORD') {
        setPasswordError(PASSWORD_HINT);
      } else {
        setFormError('Something went wrong creating your account. Please try again.');
      }
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
          <h1 className={styles.title}>Create your account</h1>
          <p className={styles.sub}>Set up and run tapas contests from here.</p>

          {formError ? (
            <div className={styles.alert} role="alert">
              <span aria-hidden="true">✕</span>
              <span>{formError}</span>
            </div>
          ) : null}

          <div className={styles.fields}>
            <FormField
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              error={emailError}
              onChange={(e) => setEmail(e.target.value)}
            />
            <FormField
              id="password"
              label="Password"
              type="password"
              autoComplete="new-password"
              value={password}
              hint={PASSWORD_HINT}
              error={passwordError}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" block disabled={submitting}>
              {submitting ? 'Creating your account…' : 'Create account'}
            </Button>
            <p className={styles.foot}>
              Already have an account? <a href="/sign-in">Sign in</a>
            </p>
          </div>
        </form>

        <aside className={styles.panel} aria-label="Tonight">
          <div className={styles.stripe} aria-hidden="true" />
          <div className={styles.content}>
            <p className={styles.kicker}>Your table</p>
            <div className={styles.contest}>Plate up the rules.</div>
            <p className={styles.detail}>
              Scoring, anti-bias, categories — set the contest once, and run the night from one
              place.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
