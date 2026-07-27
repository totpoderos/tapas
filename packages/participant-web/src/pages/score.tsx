import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@tapas/ui';
import { ApiError, getBallot, getMyScores, saveScore, sendVote, type Ballot, type Score as ScoreEntry } from '../api/client';

const REMEMBERED_CONTEST = 'tapas.contestId';
const key = (dishId: string, categoryId: string) => `${dishId} ${categoryId}`;
const seq = (min: number, max: number) => Array.from({ length: max - min + 1 }, (_, i) => min + i);

type State =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly ballot: Ballot }
  | { readonly kind: 'sent' }
  | { readonly kind: 'need-join' }
  | { readonly kind: 'error' };

/**
 * The adaptive score screen (design.md §11C). It reads the constraint view and
 * renders the control that makes an invalid vote impossible to enter: a rating
 * bounded to the allowed range when scores may repeat, or — when each category
 * is a strict ranking — a rank assignment where choosing a taken rank swaps, so
 * the ranks stay a permutation. Choices save as they are made; the vote sends
 * only once every dish is scored, and sending locks it.
 */
export function Score() {
  const { t } = useTranslation();
  const contestId = localStorage.getItem(REMEMBERED_CONTEST);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [scores, setScores] = useState<Record<string, number>>({});
  const [initial, setInitial] = useState<readonly ScoreEntry[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!contestId) {
      setState({ kind: 'need-join' });
      return;
    }
    let live = true;
    Promise.all([getBallot(contestId), getMyScores(contestId)])
      .then(([ballot, existing]) => {
        if (!live) return;
        setInitial(existing);
        setScores(Object.fromEntries(existing.map((s) => [key(s.dishId, s.categoryId), s.value])));
        setState({ kind: 'ready', ballot });
      })
      .catch((caught) => {
        if (!live) return;
        setState(caught instanceof ApiError && caught.status === 401 ? { kind: 'need-join' } : { kind: 'error' });
      });
    return () => {
      live = false;
    };
  }, [contestId]);

  /** Saves one or more scores at once (a whole category, for ranking), optimistically. */
  async function save(entries: readonly ScoreEntry[]) {
    if (!contestId) return;
    const previous = entries.map((e) => scores[key(e.dishId, e.categoryId)]);
    setScores((s) => {
      const next = { ...s };
      for (const e of entries) next[key(e.dishId, e.categoryId)] = e.value;
      return next;
    });
    setError(undefined);
    try {
      await Promise.all(entries.map((e) => saveScore(contestId, e)));
    } catch {
      setScores((s) => {
        const next = { ...s };
        entries.forEach((e, i) => {
          const k = key(e.dishId, e.categoryId);
          if (previous[i] === undefined) delete next[k];
          else next[k] = previous[i]!;
        });
        return next;
      });
      setError(t('score.errorSave'));
    }
  }

  async function onSend() {
    if (!contestId) return;
    setSending(true);
    setError(undefined);
    try {
      await sendVote(contestId);
      setState({ kind: 'sent' });
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.code === 'INCOMPLETE'
          ? t('score.errorIncomplete')
          : t('score.errorSend'),
      );
      setConfirming(false);
    } finally {
      setSending(false);
    }
  }

  const ballot = state.kind === 'ready' ? state.ballot : undefined;
  const total = ballot ? ballot.dishes.length * ballot.categories.length : 0;
  const complete = total > 0 && Object.keys(scores).length === total;

  return (
    <main id="main" className="pt-main">
      <div className="pt-brand">
        <span className="dot" aria-hidden="true" />
        <b>{t('common.brand')}</b>
      </div>

      {state.kind === 'loading' && (
        <p role="status" className="pt-note">
          {t('score.loadingBallot')}
        </p>
      )}
      {state.kind === 'need-join' && (
        <>
          <h1 className="pt-title">{t('score.joinFirstTitle')}</h1>
          <p className="pt-lead">{t('score.joinFirstLead')}</p>
          <Link to="/" className="pt-note">
            {t('score.goToJoin')}
          </Link>
        </>
      )}
      {state.kind === 'error' && (
        <p role="alert" className="pt-note">
          Your ballot couldn’t be loaded. Please try again.
        </p>
      )}
      {state.kind === 'sent' && (
        <div className="pt-joined" role="status">
          <div className="pt-check" aria-hidden="true">
            ✓
          </div>
          <p className="pt-you">{t('score.voteSent')}</p>
          <p className="pt-note">{t('score.resultsLater')}</p>
          <Link to="/reveal" className="pt-score-link">
            {t('score.seeResults')}
          </Link>
        </div>
      )}

      {ballot && (
        <>
          <h1 className="pt-title">{ballot.uniquePerCategory ? t('score.titleRank') : t('score.titleScore')}</h1>
          <p className="pt-lead">
            {ballot.uniquePerCategory
              ? t('score.leadRank')
              : t('score.leadScore')}{' '}
            {Object.keys(scores).length} of {total} done.
          </p>

          {error ? (
            <div className="pt-alert" role="alert">
              <span aria-hidden="true">✕</span>
              <span>{error}</span>
            </div>
          ) : null}

          {ballot.uniquePerCategory ? (
            <RankingInputs ballot={ballot} initial={initial} onSaveCategory={save} />
          ) : (
            <StepperInputs
              ballot={ballot}
              scores={scores}
              onRate={(dishId, categoryId, value) => void save([{ dishId, categoryId, value }])}
            />
          )}

          {confirming ? (
            <div className="pt-confirm" role="group" aria-labelledby="send-confirm-title">
              <p id="send-confirm-title" className="pt-confirm-title">
                Send your vote? You won’t be able to change it.
              </p>
              <div className="pt-confirm-actions">
                <Button variant="ghost" onClick={() => setConfirming(false)} disabled={sending}>
                  Not yet
                </Button>
                <Button onClick={() => void onSend()} disabled={sending}>
                  {sending ? t('score.sending') : t('score.confirmSend')}
                </Button>
              </div>
            </div>
          ) : (
            <Button block disabled={!complete} onClick={() => setConfirming(true)}>
              {t('score.send')}
            </Button>
          )}
        </>
      )}
    </main>
  );
}

/** Repeats-allowed: a rating per dish×category bounded to the allowed range. */
function StepperInputs({
  ballot,
  scores,
  onRate,
}: {
  ballot: Ballot;
  scores: Record<string, number>;
  onRate: (dishId: string, categoryId: string, value: number) => void;
}) {
  const values = seq(ballot.range.min, ballot.range.max);
  return (
    <ul className="pt-score-list">
      {ballot.dishes.map((dish) => (
        <li key={dish.dishId} className="pt-score-dish">
          <span className="pt-dish-name">{dish.name}</span>
          {ballot.categories.map((category) => (
            <fieldset key={category.id} className="pt-rating">
              <legend className="pt-rating-legend">{category.name}</legend>
              <div className="pt-rating-row" role="radiogroup" aria-label={`${dish.name} — ${category.name}`}>
                {values.map((value) => {
                  const chosen = scores[key(dish.dishId, category.id)] === value;
                  return (
                    <label key={value} className={`pt-rating-value ${chosen ? 'chosen' : ''}`}>
                      <input
                        type="radio"
                        name={key(dish.dishId, category.id)}
                        value={value}
                        checked={chosen}
                        onChange={() => onRate(dish.dishId, category.id, value)}
                      />
                      {value}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </li>
      ))}
    </ul>
  );
}

/**
 * Strict ranking: each open dish gets a distinct rank 1..N per category. Choosing
 * a rank another dish holds swaps the two, so the ranks stay a permutation — a
 * duplicate is impossible. A ranked dish can only change rank, never un-rank, so
 * no saved score ever needs deleting; a category persists once every dish in it
 * has a rank.
 */
function RankingInputs({
  ballot,
  initial,
  onSaveCategory,
}: {
  ballot: Ballot;
  initial: readonly ScoreEntry[];
  onSaveCategory: (entries: readonly ScoreEntry[]) => void;
}) {
  const { t } = useTranslation();
  const n = ballot.dishes.length;
  const ranksSeed = () => {
    const seed: Record<string, Record<string, number>> = {};
    for (const category of ballot.categories) {
      seed[category.id] = {};
      for (const entry of initial) {
        if (entry.categoryId === category.id) seed[category.id]![entry.dishId] = entry.value;
      }
    }
    return seed;
  };
  const [ranks, setRanks] = useState<Record<string, Record<string, number>>>(ranksSeed);

  function assign(dishId: string, categoryId: string, rank: number) {
    const current = { ...(ranks[categoryId] ?? {}) };
    const holder = Object.keys(current).find((d) => current[d] === rank && d !== dishId);
    const previous = current[dishId];
    current[dishId] = rank;
    if (holder !== undefined) {
      if (previous === undefined) delete current[holder];
      else current[holder] = previous;
    }
    setRanks((prev) => ({ ...prev, [categoryId]: current }));

    // Persist the category once every dish in it has a rank (a full permutation).
    if (ballot.dishes.every((dish) => current[dish.dishId] !== undefined)) {
      onSaveCategory(ballot.dishes.map((dish) => ({ dishId: dish.dishId, categoryId, value: current[dish.dishId]! })));
    }
  }

  return (
    <div className="pt-rank-cats">
      {ballot.categories.map((category) => (
        <section key={category.id} className="pt-rank-cat" aria-label={category.name}>
          <h2 className="pt-subhead">{category.name}</h2>
          <ul className="pt-rank-list">
            {ballot.dishes.map((dish) => {
              const rank = ranks[category.id]?.[dish.dishId];
              return (
                <li key={dish.dishId} className="pt-rank-row">
                  <span className="pt-dish-name">{dish.name}</span>
                  <select
                    className="pt-rank-select"
                    aria-label={t('score.rankFor', { dish: dish.name, category: category.name })}
                    value={rank ?? ''}
                    onChange={(e) => assign(dish.dishId, category.id, Number(e.target.value))}
                  >
                    {rank === undefined && <option value="">{t('score.rankPlaceholder')}</option>}
                    {seq(1, n).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
