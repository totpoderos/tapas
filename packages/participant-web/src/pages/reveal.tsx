import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RevealView } from '../reveal-view';
import { Nav } from '../nav';
import { PlainScreen } from '../plain-screen';
import { WaysOnward } from '../ways-onward';
import { Waiting } from '../waiting';
import {
  ApiError,
  getReveal,
  getTurnout,
  isContestDeleted,
  type Reveal as RevealData,
  type Turnout,
} from '../api/client';

const REMEMBERED_CONTEST = 'tapas.contestId';
const POLL_MS = 2000;
/*
 * How the voting stands is read on its own, slower timer.
 *
 * A venue is a dozen phones behind one address and the API's rate limit is
 * per-IP, so every poll on this screen is spent by everyone at once. Who has
 * still to vote does not change from second to second — three times the reveal's
 * interval is well inside the resolution anyone needs, and it keeps this read
 * from being the thing that exhausts the ceiling for the room.
 */
const TURNOUT_POLL_MS = 6000;

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
  // Undefined until it has been read once, and stays undefined where it cannot
  // be — the screen is built to be complete without it.
  const [turnout, setTurnout] = useState<Turnout | undefined>();

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

  /*
   * How the voting stands, on its own timer and its own failure path. It stops
   * as soon as the results are out: once there is a reveal to read, who was
   * still voting is a question about a moment that has passed.
   */
  const waiting = state.kind === 'loading' || state.kind === 'waiting';
  useEffect(() => {
    if (!contestId || !waiting) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const read = await getTurnout(contestId);
        if (!live) return;
        // Only ever replaced by a real reading: a failed poll leaves the last
        // good one on screen rather than blanking the roster mid-wait.
        if (read) setTurnout(read);
      } catch (caught) {
        // The one failure that ends the wait rather than riding it out.
        if (live && isContestDeleted(caught)) return setState({ kind: 'gone' });
      }
      if (live) timer = setTimeout(poll, TURNOUT_POLL_MS);
    };
    void poll();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [contestId, waiting]);

  // The two dead ends, flat and headerless — see score.tsx for the reasoning.
  if (state.kind === 'need-join') {
    return (
      <PlainScreen
        kind="signedOut"
        title={t('reveal.joinFirstTitle')}
        lead={t('reveal.joinFirstLead')}
        actionLabel={t('reveal.goToJoin')}
        actionTo="/"
      />
    );
  }
  if (state.kind === 'gone') {
    return (
      <PlainScreen
        kind="gone"
        title={t('reveal.goneTitle')}
        lead={t('reveal.goneLead')}
        actionLabel={t('common.joinAnother', 'Join another contest')}
        actionTo="/"
      />
    );
  }

  return (
    <>
      <Nav />
      <main id="main" className="pt-main">
      {waiting && <Waiting turnout={turnout} />}

      {state.kind === 'error' && (
        <p role="alert" className="pt-note">
          {t('reveal.errorLoad')}
        </p>
      )}

      {/* This app's own reveal. It draws the same results as the host's, and is
          no longer the same component doing it — see reveal-view.tsx. */}
      {state.kind === 'revealed' && <RevealView reveal={state.reveal} />}

      {/* Including while it waits: that is where a participant spends longest,
          and where there was otherwise nothing on the page at all. The two
          dead-end states return early now, so no guard is needed. */}
      <WaysOnward from="reveal" />
      </main>
    </>
  );
}
