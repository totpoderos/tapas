import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, CheckCircle, Info } from '@phosphor-icons/react/dist/ssr';
import { ConfirmSheet } from '../confirm-sheet';
import { Nav } from '../nav';
import { PlainScreen } from '../plain-screen';
import { ScoreTrack } from '../score-track';
import { WaysOnward } from '../ways-onward';
import styles from './score.module.css';
import { ApiError, getBallot, getMyScores, isContestDeleted, isSignedOut, saveScore, sendVote, type Ballot, type Score as ScoreEntry } from '../api/client';

const REMEMBERED_CONTEST = 'tapas.contestId';
const key = (dishId: string, categoryId: string) => `${dishId} ${categoryId}`;
const seq = (min: number, max: number) => Array.from({ length: max - min + 1 }, (_, i) => min + i);

type State =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly ballot: Ballot }
  // The ballot rides along so a sent vote can still name the dishes it scored.
  | { readonly kind: 'sent'; readonly ballot?: Ballot }
  | { readonly kind: 'need-join' }
  | { readonly kind: 'gone' }
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
  const { dish: dishParam } = useParams();
  const [query] = useSearchParams();
  const navigate = useNavigate();
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
      .then(([ballot, mine]) => {
        if (!live) return;
        setInitial(mine.scores);
        setScores(
          Object.fromEntries(mine.scores.map((s) => [key(s.dishId, s.categoryId), s.value])),
        );
        // The server, not this screen's memory, decides whether the vote is in.
        // That is what makes the answer survive a reload or a step back.
        setState(mine.status === 'sent' ? { kind: 'sent', ballot } : { kind: 'ready', ballot });
      })
      .catch((caught) => {
        if (!live) return;
        if (isContestDeleted(caught)) return setState({ kind: 'gone' });
        // `need-join` already says "join first" and links back, which is exactly
        // the right answer for a session that expired or was never kept.
        setState(isSignedOut(caught) ? { kind: 'need-join' } : { kind: 'error' });
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
      setState({ kind: 'sent', ballot });
    } catch (caught) {
      // Deleted mid-vote: there is nothing to retry, so leave the form behind
      // rather than offering a send that cannot succeed.
      if (isContestDeleted(caught)) {
        setConfirming(false);
        setState({ kind: 'gone' });
        return;
      }
      // Sending while signed out: no retry can succeed, so stop offering one.
      if (isSignedOut(caught)) {
        setConfirming(false);
        setState({ kind: 'need-join' });
        return;
      }
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
  // Names for the scores on a sent vote, where there is no editable ballot.
  const sentBallot = state.kind === 'sent' ? state.ballot : undefined;

  /*
   * What was given, a row per DISH (screen 10) — not a row per score. After
   * sending, the question is how each dish was rated; a list of every
   * dish-and-category pair answers a question nobody asked.
   *
   * The total is this participant's own sum for that dish, and is labelled as
   * theirs. It is derived the way the leaderboard's is — `tally()` sums category
   * values unweighted — so the two cannot disagree arithmetically; what they are
   * is different, because the reveal's number carries every judge and this one
   * carries only them. Hence "you gave", and hence no total at all where there
   * is a single category and the total would just repeat the score.
   *
   * It reads from `scores` rather than from what loaded, so it is the same list
   * whether the vote was sent a moment ago or on another device yesterday.
   */
  const given = (sentBallot?.dishes ?? [])
    .map((dish) => {
      const scored = sentBallot!.categories
        .map((category) => ({ name: category.name, value: scores[key(dish.dishId, category.id)] }))
        .filter((entry): entry is { name: string; value: number } => entry.value !== undefined);
      return {
        dishId: dish.dishId,
        name: dish.name,
        parts: scored.map((entry) => `${entry.name} ${entry.value}`),
        total: scored.length > 1 ? scored.reduce((sum, entry) => sum + entry.value, 0) : undefined,
      };
    })
    .filter((row) => row.parts.length > 0);

  const total = ballot ? ballot.dishes.length * ballot.categories.length : 0;
  const complete = total > 0 && Object.keys(scores).length === total;

  /** Is every category of this dish scored? What the progress rail is drawn from. */
  const dishDone = (dishId: string) =>
    !!ballot && ballot.categories.every((c) => scores[key(dishId, c.id)] !== undefined);

  /** The first score still missing, in reading order — what the ballot names and links to. */
  const missing = ballot
    ? ballot.dishes
        .flatMap((d, i) =>
          ballot.categories.map((c) => ({ dish: d, category: c, position: i + 1 })),
        )
        .find((slot) => scores[key(slot.dish.dishId, slot.category.id)] === undefined)
    : undefined;

  /*
   * Which dish the address asks for, 1-based, or undefined for the ballot itself.
   * Anything that is not a real dish — a typo, a stale link, a dish that left the
   * ballot — is not worth its own error screen; the ballot is the hub, so that is
   * where it goes.
   */
  const asked = dishParam === undefined ? undefined : Number(dishParam);
  const dishNumber =
    asked !== undefined &&
    Number.isInteger(asked) &&
    asked >= 1 &&
    ballot !== undefined &&
    asked <= ballot.dishes.length &&
    !ballot.uniquePerCategory
      ? asked
      : undefined;

  useEffect(() => {
    if (!ballot || dishParam === undefined || dishNumber !== undefined) return;
    navigate('/score', { replace: true });
  }, [ballot, dishParam, dishNumber, navigate]);

  // Two dead ends, drawn flat and without the header: nothing here is operable
  // except the way out, so nothing else is offered.
  if (state.kind === 'need-join') {
    return (
      <PlainScreen
        kind="signedOut"
        title={t('score.joinFirstTitle')}
        lead={t('score.joinFirstLead')}
        actionLabel={t('score.goToJoin')}
        actionTo="/"
      />
    );
  }
  if (state.kind === 'gone') {
    return (
      <PlainScreen
        kind="gone"
        title={t('score.goneTitle')}
        lead={t('score.goneLead')}
        actionLabel={t('common.joinAnother', 'Join another contest')}
        actionTo="/"
      />
    );
  }

  return (
    <>
      {/* How far along, wherever they are in the ballot — the one fact worth a
          permanent place on the screen while scoring. */}
      <Nav
        context={
          ballot && !ballot.uniquePerCategory
            ? t('score.navProgress', { done: Object.keys(scores).length, total })
            : undefined
        }
      />
      <main id="main" className="pt-main">
      {state.kind === 'loading' && (
        <p role="status" className="pt-note">
          {t('score.loadingBallot')}
        </p>
      )}
      {state.kind === 'error' && (
        <p role="alert" className="pt-note">
          Your ballot couldn’t be loaded. Please try again.
        </p>
      )}
      {state.kind === 'sent' && (
        <div className={styles.sent}>
          {/* The change of state is what is announced — not the record below it,
              which is there to be read rather than recited. */}
          <div className={styles.sentHead} role="status">
            <span className={styles.sentMark} aria-hidden="true">
              <CheckCircle size={44} weight="duotone" />
            </span>
            <h1 className={styles.sentTitle}>{t('score.voteSent')}</h1>
            <p className={styles.sentLead}>{t('score.alreadySentLead')}</p>
          </div>

          {given.length > 0 && (
            <ul className={styles.given} aria-label={t('score.alreadySentTitle')}>
              {given.map((row) => (
                <li key={row.dishId} className={styles.givenRow}>
                  <span className={styles.givenDish}>{row.name}</span>
                  <span className={styles.givenDetail}>
                    <span className={styles.givenScores}>{row.parts.join(' · ')}</span>
                    {row.total !== undefined && (
                      <span className={styles.givenTotal}>
                        {t('score.youGave', { total: row.total })}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <p className={styles.sentNote}>{t('score.resultsLater')}</p>
          <Link to="/reveal" className={styles.sentLink}>
            {t('score.seeResults')}
          </Link>
        </div>
      )}

      {/* Strict ranking keeps its own control and its single page — no design
          exists for paginating it, and inventing one here would date the moment
          a brief arrives. It wears the new palette and nothing else changes. */}
      {ballot && ballot.uniquePerCategory && (
        <div className={styles.screen}>
          <h1 className={styles.dishName}>{t('score.titleRank')}</h1>
          <p className={styles.dishDescription}>{t('score.leadRank')}</p>
          {error ? (
            <p className={styles.incomplete} role="alert">
              <Info size={18} weight="duotone" aria-hidden="true" />
              <span>{error}</span>
            </p>
          ) : null}
          <RankingInputs ballot={ballot} initial={initial} onSaveCategory={save} />
          <SendControls
            complete={complete}
            confirming={confirming}
            sending={sending}
            onAsk={() => setConfirming(true)}
            onCancel={() => setConfirming(false)}
            onSend={() => void onSend()}
          />
        </div>
      )}

      {/* One dish (screen 7). */}
      {ballot && dishNumber !== undefined && (
        <OneDish
          ballot={ballot}
          number={dishNumber}
          scores={scores}
          dishDone={dishDone}
          focusCategory={query.get('category') ?? undefined}
          error={error}
          onRate={(dishId, categoryId, value) => void save([{ dishId, categoryId, value }])}
        />
      )}

      {/* The ballot itself (screen 8) — everything at once, and the way to send. */}
      {ballot && !ballot.uniquePerCategory && dishNumber === undefined && (
        <BallotReview
          ballot={ballot}
          scores={scores}
          dishDone={dishDone}
          missing={missing}
          complete={complete}
          confirming={confirming}
          sending={sending}
          error={error}
          onAsk={() => setConfirming(true)}
          onCancel={() => setConfirming(false)}
          onSend={() => void onSend()}
        />
      )}
      {/* Always reachable from here, however they arrived — a link, the back
          button, a reload, or the address typed straight in. At the foot, under
          whichever screen is showing, rather than above it. */}
      <WaysOnward from="score" />
      </main>
    </>
  );
}

/**
 * Asking to send, and the confirmation that stands between asking and sending.
 *
 * The trigger stays on the screen while the sheet is open rather than being
 * swapped out for it: declining has to put the participant back exactly where
 * they were, and the cheapest way to keep that true is never to have moved.
 */
function SendControls({
  complete,
  confirming,
  sending,
  onAsk,
  onCancel,
  onSend,
}: {
  complete: boolean;
  confirming: boolean;
  sending: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onSend: () => void;
}) {
  const { t } = useTranslation();
  const ask = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={ask} type="button" className={styles.send} disabled={!complete} onClick={onAsk}>
        {t('score.send')}
      </button>
      {confirming && (
        <ConfirmSheet
          title={t('score.confirmTitle')}
          lead={t('score.confirmLead')}
          confirmLabel={sending ? t('score.sending') : t('score.confirmSend')}
          cancelLabel={t('score.notYet')}
          busy={sending}
          returnFocusTo={ask}
          onConfirm={onSend}
          onCancel={onCancel}
        />
      )}
    </>
  );
}

/** How far through the dishes, by dish — not by individual score. */
function ProgressRail({
  ballot,
  dishDone,
}: {
  ballot: Ballot;
  dishDone: (dishId: string) => boolean;
}) {
  const remaining = ballot.dishes.filter((d) => !dishDone(d.dishId)).length;
  return (
    <ul className={styles.rail} aria-hidden="true">
      {ballot.dishes.map((dish) => {
        const done = dishDone(dish.dishId);
        return (
          <li
            key={dish.dishId}
            className={[
              styles.railBar,
              done ? styles.railBarDone : '',
              // The one still outstanding reads amber: nearly, not merely not-yet.
              !done && remaining === 1 ? styles.railBarLast : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        );
      })}
    </ul>
  );
}

/**
 * One dish, with a track per category (screen 7).
 *
 * Which dish is in the address, so the back control goes to the dish before
 * rather than out of the app, the ballot can link straight to what is missing,
 * and a reload puts a participant back where they were.
 */
function OneDish({
  ballot,
  number,
  scores,
  dishDone,
  focusCategory,
  error,
  onRate,
}: {
  ballot: Ballot;
  number: number;
  scores: Record<string, number>;
  dishDone: (dishId: string) => boolean;
  focusCategory?: string;
  error?: string;
  onRate: (dishId: string, categoryId: string, value: number) => void;
}) {
  const { t } = useTranslation();
  const dish = ballot.dishes[number - 1]!;
  const last = number === ballot.dishes.length;
  const focused = useRef(false);

  /*
   * Arriving from the ballot's "…missing" link lands on the category it named,
   * with the keyboard already there — otherwise following the link leaves a
   * participant to find it again themselves.
   */
  useEffect(() => {
    if (!focusCategory || focused.current) return;
    focused.current = true;
    const group = document.querySelector<HTMLElement>(`[data-category="${focusCategory}"]`);
    group?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
    group?.scrollIntoView({ block: 'center' });
  }, [focusCategory]);

  return (
    <div className={styles.screen}>
      <ProgressRail ballot={ballot} dishDone={dishDone} />

      <p className={styles.kicker}>
        {t('score.dishOf', { number, total: ballot.dishes.length })}
      </p>
      <h1 className={styles.dishName}>{dish.name}</h1>

      {error ? (
        <p className={styles.incomplete} role="alert">
          <Info size={18} weight="duotone" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}

      <div className={styles.categories}>
        {ballot.categories.map((category) => (
          <div key={category.id} data-category={category.id}>
            <ScoreTrack
              categoryName={category.name}
              groupLabel={`${dish.name} — ${category.name}`}
              name={key(dish.dishId, category.id)}
              min={ballot.range.min}
              max={ballot.range.max}
              value={scores[key(dish.dishId, category.id)]}
              onChange={(value) => onRate(dish.dishId, category.id, value)}
            />
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        <Link
          className={styles.back}
          to={number === 1 ? '/score' : `/score/${number - 1}`}
          aria-label={number === 1 ? t('score.backToBallot') : t('score.previousDish')}
        >
          <ArrowLeft size={22} weight="duotone" aria-hidden="true" />
        </Link>
        <Link className={styles.onward} to={last ? '/score' : `/score/${number + 1}`}>
          <span>{last ? t('score.reviewBallot') : t('score.nextDish')}</span>
          <ArrowRight size={20} weight="duotone" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

/**
 * The whole ballot before sending (screen 8).
 *
 * Scoring a dish at a time hides what has already been done, and a send button
 * that is merely disabled says nothing about why. This shows every dish with
 * what it was given, names the first thing still missing, and links to it.
 */
function BallotReview({
  ballot,
  scores,
  dishDone,
  missing,
  complete,
  confirming,
  sending,
  error,
  onAsk,
  onCancel,
  onSend,
}: {
  ballot: Ballot;
  scores: Record<string, number>;
  dishDone: (dishId: string) => boolean;
  missing?: { dish: { dishId: string; name: string }; category: { id: string; name: string }; position: number };
  complete: boolean;
  confirming: boolean;
  sending: boolean;
  error?: string;
  onAsk: () => void;
  onCancel: () => void;
  onSend: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className={styles.screen}>
      <ProgressRail ballot={ballot} dishDone={dishDone} />
      <h1 className={styles.dishName}>{t('score.ballotTitle')}</h1>
      <p className={styles.dishDescription}>
        {missing
          ? t('score.ballotLeadIncomplete', {
              dish: missing.dish.name,
              category: missing.category.name,
            })
          : t('score.ballotLeadComplete')}
      </p>

      {error ? (
        <p className={styles.incomplete} role="alert">
          <Info size={18} weight="duotone" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}

      <ul className={styles.ballot} aria-label={t('score.ballotTitle')}>
        {ballot.dishes.map((dish, i) => {
          const given = ballot.categories.map((c) => scores[key(dish.dishId, c.id)]);
          const short = ballot.categories.find(
            (c) => scores[key(dish.dishId, c.id)] === undefined,
          );
          return (
            <li key={dish.dishId} className={styles.ballotRow}>
              <span className={styles.ballotDish}>{dish.name}</span>
              {short ? (
                <Link
                  className={styles.missing}
                  to={`/score/${i + 1}?category=${encodeURIComponent(short.id)}`}
                >
                  {t('score.categoryMissing', { category: short.name })}
                </Link>
              ) : (
                <span className={styles.ballotScores}>{given.join(' · ')}</span>
              )}
            </li>
          );
        })}
      </ul>

      {missing ? (
        <p className={styles.incomplete}>
          <Info size={18} weight="duotone" aria-hidden="true" />
          <span>{t('score.errorIncomplete')}</span>
        </p>
      ) : null}

      <SendControls
        complete={complete}
        confirming={confirming}
        sending={sending}
        onAsk={onAsk}
        onCancel={onCancel}
        onSend={onSend}
      />
    </div>
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
    <div>
      {ballot.categories.map((category) => (
        <section key={category.id} className={styles.rankCategory} aria-label={category.name}>
          <h2 className={styles.rankTitle}>{category.name}</h2>
          <ul className={styles.ballot}>
            {ballot.dishes.map((dish) => {
              const rank = ranks[category.id]?.[dish.dishId];
              return (
                <li key={dish.dishId} className={styles.rankRow}>
                  <span className={styles.rankDish}>{dish.name}</span>
                  <select
                    className={styles.rankSelect}
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
