import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, getReveal, type Reveal as RevealData, type Winner } from '../api/client';

const REMEMBERED_CONTEST = 'tapas.contestId';
const POLL_MS = 2000;

type State =
  | { readonly kind: 'loading' }
  | { readonly kind: 'waiting' }
  | { readonly kind: 'revealed'; readonly reveal: RevealData }
  | { readonly kind: 'need-join' }
  | { readonly kind: 'error' };

const names = (winners: readonly Winner[]) => winners.map((w) => w.name).join(' & ');

/**
 * The reveal (design.md §11C): a deliberate beat. Until the host reveals, the
 * screen waits — quietly polling — then the winners appear without a reload. The
 * moment leans on saffron (reserved for winners) and a short animation that
 * `prefers-reduced-motion` neutralises via the shared tokens.
 */
export function Reveal() {
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
        <b>Tapas</b>
      </div>

      {(state.kind === 'loading' || state.kind === 'waiting') && (
        <div className="pt-waiting" role="status" aria-live="polite">
          <div className="pt-waiting-dot" aria-hidden="true" />
          <p className="pt-you">Almost there…</p>
          <p className="pt-note">The results appear the moment the host reveals them.</p>
        </div>
      )}

      {state.kind === 'need-join' && (
        <>
          <h1 className="pt-title">Join first</h1>
          <p className="pt-lead">You need to join the contest before you can see the results.</p>
          <Link to="/" className="pt-note">
            Go to join
          </Link>
        </>
      )}

      {state.kind === 'error' && (
        <p role="alert" className="pt-note">
          The results couldn’t be loaded. Please try again.
        </p>
      )}

      {state.kind === 'revealed' && <RevealMoment reveal={state.reveal} />}
    </main>
  );
}

function RevealMoment({ reveal }: { reveal: RevealData }) {
  return (
    <div className="pt-reveal" aria-live="polite">
      <p className="pt-reveal-kicker">{reveal.contestName}</p>
      <div className="pt-trophy" aria-hidden="true">
        🏆
      </div>
      <h1 className="pt-reveal-title">
        {reveal.overall.winners.length > 1 ? 'Joint winners' : 'Winner'}
      </h1>
      <p className="pt-reveal-winner">{names(reveal.overall.winners)}</p>

      {reveal.categories.length > 1 && (
        <section className="pt-reveal-cats" aria-label="Category winners">
          <h2 className="pt-subhead">Best in each category</h2>
          <ul className="pt-cat-list">
            {reveal.categories.map((category) => (
              <li key={category.categoryId} className="pt-cat-row">
                <span className="pt-cat-name">{category.name}</span>
                <span className="pt-cat-winner">{names(category.winners)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Leaderboard">
        <h2 className="pt-subhead">Leaderboard</h2>
        <ol className="pt-board">
          {reveal.overall.standings.map((standing, i) => (
            <li key={standing.dishId} className="pt-board-row">
              <span className="pt-board-rank">{i + 1}</span>
              <span className="pt-board-name">{standing.name}</span>
              <span className="pt-board-total">{standing.total}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
