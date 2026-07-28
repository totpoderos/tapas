import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { RevealView } from '@tapas/ui';
import { WaysOnward } from '../ways-onward';
import { ApiError, getReveal, isContestDeleted, type Reveal as RevealData } from '../api/client';

const REMEMBERED_CONTEST = 'tapas.contestId';
const POLL_MS = 2000;

type State =
  | { readonly kind: 'loading' }
  | { readonly kind: 'waiting' }
  | { readonly kind: 'revealed'; readonly reveal: RevealData }
  | { readonly kind: 'need-join' }
  | { readonly kind: 'gone' }
  | { readonly kind: 'error' };

/**
 * The reveal (design.md §11C): a deliberate beat. Until the host reveals, the
 * screen waits — quietly polling — then the winners appear without a reload. The
 * moment leans on saffron (reserved for winners) and a short animation that
 * `prefers-reduced-motion` neutralises via the shared tokens.
 */
export function Reveal() {
  const { t } = useTranslation();
  const contestId = localStorage.getItem(REMEMBERED_CONTEST);
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    if (!contestId) {
      setState({ kind: 'need-join' });
      return;
    }
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const reveal = await getReveal(contestId);
        if (!live) return;
        if (reveal) {
          setState({ kind: 'revealed', reveal });
        } else {
          setState((s) => (s.kind === 'loading' ? { kind: 'waiting' } : s));
          timer = setTimeout(poll, POLL_MS);
        }
      } catch (caught) {
        if (!live) return;
        // The host deleted it while we waited — stop polling and say so, rather
        // than leaving them on "almost there…" for a result that will never come.
        if (isContestDeleted(caught)) return setState({ kind: 'gone' });
        setState(caught instanceof ApiError && caught.status === 401 ? { kind: 'need-join' } : { kind: 'error' });
      }
    };
    void poll();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [contestId]);

  return (
    <main id="main" className="pt-main">
      <div className="pt-brand">
        <span className="dot" aria-hidden="true" />
        <b>{t('common.brand')}</b>
      </div>

      {(state.kind === 'loading' || state.kind === 'waiting') && (
        <div className="pt-waiting" role="status" aria-live="polite">
          <div className="pt-waiting-dot" aria-hidden="true" />
          <p className="pt-you">{t('reveal.waitingLead')}</p>
          <p className="pt-note">{t('reveal.waitingNote')}</p>
        </div>
      )}

      {state.kind === 'need-join' && (
        <>
          <h1 className="pt-title">{t('reveal.joinFirstTitle')}</h1>
          <p className="pt-lead">{t('reveal.joinFirstLead')}</p>
          <Link to="/" className="pt-note">
            {t('reveal.goToJoin')}
          </Link>
        </>
      )}

      {state.kind === 'gone' && (
        <>
          <h1 className="pt-title">{t('reveal.goneTitle')}</h1>
          <p className="pt-lead">{t('reveal.goneLead')}</p>
          <Link to="/" className="pt-note">
            {t('reveal.goToJoin')}
          </Link>
        </>
      )}

      {state.kind === 'error' && (
        <p role="alert" className="pt-note">
          {t('reveal.errorLoad')}
        </p>
      )}

      {/* The reveal itself is the shared view — the host sees exactly this. */}
      {state.kind === 'revealed' && <RevealView reveal={state.reveal} />}

      {/* Including while it waits: that is where a participant spends longest,
          and where there was otherwise nothing on the page at all. */}
      {state.kind !== 'need-join' && state.kind !== 'gone' && <WaysOnward from="reveal" />}
    </main>
  );
}
