import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { RevealView, type RevealData } from '@tapas/ui';
import { ApiError, getWinners } from '../api/client';
import styles from './results.module.css';

type State =
  | { readonly kind: 'loading' }
  | { readonly kind: 'revealed'; readonly reveal: RevealData }
  | { readonly kind: 'not-yet' }
  | { readonly kind: 'missing' }
  | { readonly kind: 'error' };

/**
 * The host watching the ending, along with everyone else. It renders the very
 * same `RevealView` the participants are looking at on their phones — the host
 * ran the contest, but at this moment they are a spectator, not an announcer
 * reading from a table of totals.
 *
 * Unlike the participant screen this does not poll: the host arrives here after
 * revealing, so there is nothing to wait for. A host who lands here before the
 * reveal (from a stale page, or by typing the address) is told so and sent to the
 * control room, which is where revealing actually happens.
 */
export function Results() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let live = true;
    getWinners(id)
      .then((reveal) => {
        if (!live) return;
        // `null` is the API's "not revealed yet" (409) — never an empty result.
        setState(reveal ? { kind: 'revealed', reveal } : { kind: 'not-yet' });
      })
      .catch((caught: unknown) => {
        if (!live) return;
        const missing =
          caught instanceof ApiError && (caught.status === 404 || caught.status === 403);
        setState(missing ? { kind: 'missing' } : { kind: 'error' });
      });
    return () => {
      live = false;
    };
  }, [id]);

  return (
    <main id="main" className={styles.page}>
      {state.kind === 'loading' && (
        <p role="status" className={styles.note}>
          {t('results.loading')}
        </p>
      )}

      {/*
       * These keep a heading of their own rather than becoming an `EmptyState`.
       * That component's lead is a paragraph — right for "no rows in this list",
       * wrong here, where the state *is* the page and dropping the heading would
       * leave the screen with none at all. The revealed state has one from
       * `RevealView`; these two should not be the odd pages out.
       */}
      {state.kind === 'not-yet' && (
        <>
          <h1 className={styles.title}>{t('results.notYetTitle')}</h1>
          <p className={styles.note}>{t('results.notYetBody')}</p>
          {/* Revealing happens in the control room, so the way there is offered
              rather than left for the host to find. */}
          <p>
            <Link to={`/contest/${id}`} className={styles.wayOut}>
              {t('results.goToControl')}
            </Link>
          </p>
        </>
      )}

      {state.kind === 'missing' && (
        <>
          <h1 className={styles.title}>{t('results.notFoundTitle')}</h1>
          <p className={styles.note}>{t('results.notFoundBody')}</p>
        </>
      )}

      {state.kind === 'error' && (
        <p role="alert" className={styles.note}>
          {t('results.loadError')}
        </p>
      )}

      {state.kind === 'revealed' && <RevealView reveal={state.reveal} />}
    </main>
  );
}
