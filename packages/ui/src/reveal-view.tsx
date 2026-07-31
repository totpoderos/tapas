import { useTranslation } from 'react-i18next';
import styles from './reveal-view.module.css';

/** A dish's place on a reveal leaderboard. */
export interface RevealStanding {
  readonly dishId: string;
  readonly name: string;
  readonly total: number;
}

export interface RevealWinner {
  readonly dishId: string;
  /** The dish, by the name it was submitted under. */
  readonly name: string;
  /**
   * Who brought it — one cook, or both halves of a couple under `per_couple`
   * attribution.
   *
   * `RevealData` is the shape both apps agree on, so the field is here even
   * though only the participant's reveal draws it: the host's screen is a
   * workspace and names dishes, the participant's is the moment of the evening
   * and names people. Optional because a payload from before this existed is
   * still a valid result.
   */
  readonly cooks?: readonly string[];
}

/** The revealed results: winners and leaderboards, by dish name. */
export interface RevealData {
  readonly contestName: string;
  readonly overall: {
    readonly winners: readonly RevealWinner[];
    readonly standings: readonly RevealStanding[];
  };
  readonly categories: readonly {
    readonly categoryId: string;
    readonly name: string;
    readonly winners: readonly RevealWinner[];
    readonly standings: readonly RevealStanding[];
  }[];
}

const names = (winners: readonly RevealWinner[]) => winners.map((w) => w.name).join(' & ');

/**
 * The reveal as the HOST draws it. The participant app draws its own copy now
 * (packages/participant-web/src/reveal-view.tsx) — the two became different
 * products, so they no longer share a renderer. `RevealData` stays here and is
 * imported by both: the shape is the thing that has to agree.
 *
 * Because one component no longer draws both, "host and participant see the
 * same results" is no longer true by construction. It is held by a test across
 * the two rendered screens (tests/e2e/host-sees-the-results.feature). Changing
 * what this draws — the order of the leaderboard, how many rows it shows, what
 * a dish is called — will and should fail it.
 *
 * Before rewriting any of this, read the four properties at the head of
 * reveal-view.module.css. They are invisible in a screenshot and were each paid
 * for once already.
 *
 * Translation keys are given as FULL paths with English defaults: this component
 * resolves them against whichever app renders it, and i18next answers a missing
 * key by echoing the key itself — which, in a label, is read aloud. Both apps
 * must therefore carry a `reveal` resource; the defaults here are the safety net,
 * not the plan.
 */
export function RevealView({ reveal }: { reveal: RevealData }) {
  const { t } = useTranslation();
  const joint = reveal.overall.winners.length > 1;

  return (
    <div className={styles.reveal} aria-live="polite">
      <p className={styles.kicker}>{reveal.contestName}</p>
      <div className={styles.trophy} aria-hidden="true">
        🏆
      </div>
      <h1 className={styles.title}>
        {joint ? t('reveal.jointWinners', 'Joint winners') : t('reveal.winner', 'Winner')}
      </h1>
      <p className={styles.winner}>{names(reveal.overall.winners)}</p>

      {reveal.categories.length > 1 && (
        <section
          className={styles.cats}
          aria-label={t('reveal.categoryWinnersLabel', 'Category winners')}
        >
          <h2 className={styles.subhead}>
            {t('reveal.bestInCategory', 'Best in each category')}
          </h2>
          <ul className={styles.catList}>
            {reveal.categories.map((category) => (
              <li key={category.categoryId} className={styles.catRow}>
                <span className={styles.catName}>{category.name}</span>
                <span className={styles.catWinner}>{names(category.winners)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label={t('reveal.leaderboard', 'Leaderboard')}>
        <h2 className={styles.subhead}>{t('reveal.leaderboard', 'Leaderboard')}</h2>
        <ol className={styles.board}>
          {reveal.overall.standings.map((standing, i) => (
            <li key={standing.dishId} className={styles.boardRow}>
              <span className={styles.boardRank}>{i + 1}</span>
              <span className={styles.boardName}>{standing.name}</span>
              <span className={styles.boardTotal}>{standing.total}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
