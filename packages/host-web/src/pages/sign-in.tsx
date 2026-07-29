import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const { signIn, deploymentUnclaimed } = useSession();
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
          ? t('signIn.errorCredentials')
          : t('signIn.errorGeneric'),
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
            <b>{t('common.brand')}</b>
          </div>
          <h1 className={styles.title}>{t('signIn.title')}</h1>
          <p className={styles.sub}>{t('signIn.subtitle')}</p>

          {deploymentUnclaimed ? (
            <p className={styles.sub}>
              {t('signIn.unclaimedNotice')} <a href="/claim">{t('signIn.unclaimedLink')}</a>
            </p>
          ) : null}

          {error ? (
            <div className={styles.alert} role="alert">
              <span aria-hidden="true">✕</span>
              <span>{error}</span>
            </div>
          ) : null}

          <div className={styles.fields}>
            <FormField
              id="email"
              label={t('signIn.email')}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <FormField
              id="password"
              label={t('signIn.password')}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" block disabled={submitting}>
              {submitting ? t('signIn.submitting') : t('signIn.submit')}
            </Button>
            <p className={styles.foot}>
              {t('signIn.footPrompt')} <a href="/sign-up">{t('signIn.footLink')}</a>
            </p>
          </div>
        </form>

        <aside className={styles.panel} aria-label={t('signIn.panelKicker')}>
          <div className={styles.stripe} aria-hidden="true" />
          <div className={styles.content}>
            <p className={styles.kicker}>{t('signIn.panelKicker')}</p>
            <div className={styles.contest}>{t('signIn.panelContest')}</div>
            <p className={styles.detail}>{t('signIn.panelDetail')}</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
