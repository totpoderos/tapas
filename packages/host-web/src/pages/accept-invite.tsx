import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { Button, FormField } from '@tapas/ui';
import { ApiError, readInvitation } from '../api/client';
import { useSession } from '../auth/session';
import styles from './auth.module.css';

type Screen =
  | { kind: 'reading' }
  | { kind: 'usable'; email: string }
  | { kind: 'unusable' }
  | { kind: 'accountReady' };

/**
 * Where an invitation link lands, and the only way anybody gets an account:
 * open registration was removed once this existed. It began as the sign-up
 * screen with its email field replaced by the address the API reports.
 *
 * Two states from the read on mount, and no third. A link that cannot be used
 * gets one message: the API answers identically whether it never existed, was
 * used, ran out of time, was revoked, or was replaced, so this screen is given
 * nothing to tell them apart with and must not appear to have it.
 */
export function AcceptInvite() {
  const { t } = useTranslation();
  const { token = '' } = useParams();
  const { acceptInvitation } = useSession();
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>({ kind: 'reading' });
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let live = true;
    readInvitation(token)
      .then(({ email }) => live && setScreen({ kind: 'usable', email }))
      .catch(() => live && setScreen({ kind: 'unusable' }));
    return () => {
      live = false;
    };
  }, [token]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (screen.kind !== 'usable') return;
    setPasswordError(undefined);
    setFormError(undefined);
    setSubmitting(true);
    try {
      const outcome = await acceptInvitation(token, password, screen.email);
      // This route is not session-gated — it cannot be, its visitor has no
      // account when they arrive — so nothing redirects on its own once the
      // session flips. The page takes them home itself.
      if (outcome === 'signed-in') navigate('/', { replace: true });
      else setScreen({ kind: 'accountReady' });
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : undefined;
      if (code === 'WEAK_PASSWORD') setPasswordError(t('acceptInvite.passwordHint'));
      else if (code === 'INVITATION_UNUSABLE') setScreen({ kind: 'unusable' });
      else setFormError(t('acceptInvite.errorGeneric'));
      setSubmitting(false);
    }
  }

  return (
    <main id="main" className={styles.page}>
      <div className={styles.card}>
        {screen.kind === 'unusable' ? (
          <div className={styles.form}>
            <Brand />
            <h1 className={styles.title}>{t('acceptInvite.unusableTitle')}</h1>
            <p className={styles.sub}>{t('acceptInvite.unusableBody')}</p>
          </div>
        ) : screen.kind === 'accountReady' ? (
          <div className={styles.form}>
            <Brand />
            <h1 className={styles.title}>{t('acceptInvite.readyTitle')}</h1>
            <p className={styles.sub}>{t('acceptInvite.readyBody')}</p>
            <p className={styles.foot}>
              <a href="/sign-in">{t('acceptInvite.signIn')}</a>
            </p>
          </div>
        ) : screen.kind === 'reading' ? (
          <div className={styles.form}>
            <Brand />
            <p role="status">{t('common.loading')}</p>
          </div>
        ) : (
          <form className={styles.form} onSubmit={onSubmit} noValidate>
            <Brand />
            <h1 className={styles.title}>{t('acceptInvite.title')}</h1>
            <p className={styles.sub}>
              {t('acceptInvite.subtitle', { email: screen.email })}
            </p>

            {formError ? (
              <div className={styles.alert} role="alert">
                <span aria-hidden="true">✕</span>
                <span>{formError}</span>
              </div>
            ) : null}

            <div className={styles.fields}>
              <FormField
                id="password"
                label={t('acceptInvite.password')}
                type="password"
                autoComplete="new-password"
                value={password}
                hint={t('acceptInvite.passwordHint')}
                error={passwordError}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" block disabled={submitting}>
                {submitting ? t('acceptInvite.submitting') : t('acceptInvite.submit')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

function Brand() {
  const { t } = useTranslation();
  return (
    <div className={styles.brand}>
      <span className={styles.dot} aria-hidden="true" />
      <b>{t('common.brand')}</b>
    </div>
  );
}
