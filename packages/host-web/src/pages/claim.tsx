import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, FormField } from '@tapas/ui';
import { ApiError, claimDeployment, isDeploymentUnclaimed } from '../api/client';
import styles from './auth.module.css';

type Screen =
  | { kind: 'asking' }
  | { kind: 'unclaimed' }
  | { kind: 'claimed' }
  | { kind: 'sent' }
  | { kind: 'couldNotSend'; link: string };

/**
 * The first-run screen. `/claim`, not `/setup`, because `/setup` forwards to the
 * API — a browsable route there would be proxied away on a direct load.
 *
 * This is the one screen in the app that asks nothing about who is visiting. It
 * asks the API what the deployment is and renders the answer, the same for a
 * stranger, a host, and an administrator — because on a deployment nobody has
 * claimed there is nobody to be. Wrapping it in the session guard its neighbours
 * use would break the only case it exists for.
 *
 * It also stays reachable once claimed, saying so plainly. Sending it back to
 * sign-in would put two conditional redirects in opposition, and they disagree
 * exactly while somebody is claiming — which a browser resolves by looping.
 */
export function Claim() {
  const { t } = useTranslation();
  const [screen, setScreen] = useState<Screen>({ kind: 'asking' });
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let live = true;
    isDeploymentUnclaimed()
      .then((unclaimed) => live && setScreen({ kind: unclaimed ? 'unclaimed' : 'claimed' }))
      .catch(() => live && setScreen({ kind: 'claimed' }));
    return () => {
      live = false;
    };
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    setSubmitting(true);
    try {
      const claimed = await claimDeployment(email);
      // A deployment being claimed has no administrator to resend for it, and
      // its mail is the thing most likely not working yet — so a message that
      // did not go out shows the link rather than pointing at an empty inbox.
      setScreen(
        claimed.messageSent
          ? { kind: 'sent' }
          : { kind: 'couldNotSend', link: claimed.link ?? '' },
      );
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : undefined;
      // Never says which address would have worked: that would make an
      // anonymous screen a way to read the deployment's configuration.
      if (code === 'CLAIM_REFUSED') setFormError(t('claim.errorRefused'));
      else if (code === 'SETUP_COMPLETE') setScreen({ kind: 'claimed' });
      else setFormError(t('claim.errorGeneric'));
      setSubmitting(false);
    }
  }

  return (
    <main id="main" className={styles.page}>
      <div className={styles.card}>
        <div className={styles.form}>
          <div className={styles.brand}>
            <span className={styles.dot} aria-hidden="true" />
            <b>{t('common.brand')}</b>
          </div>

          {screen.kind === 'asking' ? <p role="status">{t('common.loading')}</p> : null}

          {screen.kind === 'claimed' ? (
            <>
              <h1 className={styles.title}>{t('claim.claimedTitle')}</h1>
              <p className={styles.sub}>{t('claim.claimedBody')}</p>
              <p className={styles.foot}>
                <a href="/sign-in">{t('claim.signIn')}</a>
              </p>
            </>
          ) : null}

          {screen.kind === 'sent' ? (
            <>
              <h1 className={styles.title}>{t('claim.sentTitle')}</h1>
              <p className={styles.sub}>{t('claim.sentBody')}</p>
            </>
          ) : null}

          {screen.kind === 'couldNotSend' ? (
            <>
              <h1 className={styles.title}>{t('claim.notSentTitle')}</h1>
              <p className={styles.sub}>{t('claim.notSentBody')}</p>
              <p className={styles.sub}>
                <code>{screen.link}</code>
              </p>
            </>
          ) : null}

          {screen.kind === 'unclaimed' ? (
            <form onSubmit={onSubmit} noValidate>
              <h1 className={styles.title}>{t('claim.title')}</h1>
              <p className={styles.sub}>{t('claim.subtitle')}</p>

              {formError ? (
                <div className={styles.alert} role="alert">
                  <span aria-hidden="true">✕</span>
                  <span>{formError}</span>
                </div>
              ) : null}

              <div className={styles.fields}>
                <FormField
                  id="email"
                  label={t('claim.email')}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Button type="submit" block disabled={submitting}>
                  {submitting ? t('claim.submitting') : t('claim.submit')}
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </main>
  );
}
