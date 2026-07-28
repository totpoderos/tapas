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
  readonly name: string;
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
 * The reveal, rendered identically for a participant watching and for the host
 * watching along with them. It takes the results as a prop — fetching, polling
 * and routing stay with each app, so the two screens cannot drift apart in what
 * they show (design.md §11C).
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
