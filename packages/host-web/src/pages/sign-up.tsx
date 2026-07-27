import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, FormField } from '@tapas/ui';
import { ApiError } from '../api/client';
import { useSession } from '../auth/session';
import styles from './auth.module.css';

/**
 * Host sign-up (design system "Host sign-in/up"). Creates the account and signs
 * the host straight in. The API is the authority on the password policy and
 * duplicate emails; its errors are surfaced where the host can act on them — a
 * weak password or malformed email on the field itself (announced), a taken
 * email as a form-level notice pointing at sign-in.
 */
export function SignUp() {
  const { t } = useTranslation();
  const passwordHint = t('signUp.passwordHint');
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
        setFormError(t('signUp.errorEmailTaken'));
      } else if (code === 'INVALID_EMAIL') {
        setEmailError(t('signUp.errorInvalidEmail'));
      } else if (code === 'WEAK_PASSWORD') {
        setPasswordError(passwordHint);
      } else {
        setFormError(t('signUp.errorGeneric'));
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
            <b>{t('common.brand')}</b>
          </div>
          <h1 className={styles.title}>{t('signUp.title')}</h1>
          <p className={styles.sub}>{t('signUp.subtitle')}</p>

          {formError ? (
            <div className={styles.alert} role="alert">
              <span aria-hidden="true">✕</span>
              <span>{formError}</span>
            </div>
          ) : null}

          <div className={styles.fields}>
            <FormField
              id="email"
              label={t('signUp.email')}
              type="email"
              autoComplete="email"
              value={email}
              error={emailError}
              onChange={(e) => setEmail(e.target.value)}
            />
            <FormField
              id="password"
              label={t('signUp.password')}
              type="password"
              autoComplete="new-password"
              value={password}
              hint={passwordHint}
              error={passwordError}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" block disabled={submitting}>
              {submitting ? t('signUp.submitting') : t('signUp.submit')}
            </Button>
            <p className={styles.foot}>
              {t('signUp.footPrompt')} <a href="/sign-in">{t('signUp.footLink')}</a>
            </p>
          </div>
        </form>

        <aside className={styles.panel} aria-label={t('signUp.panelKicker')}>
          <div className={styles.stripe} aria-hidden="true" />
          <div className={styles.content}>
            <p className={styles.kicker}>{t('signUp.panelKicker')}</p>
            <div className={styles.contest}>{t('signUp.panelContest')}</div>
            <p className={styles.detail}>{t('signUp.panelDetail')}</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
