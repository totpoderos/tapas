import { useTranslation } from 'react-i18next';
import type { RevealData, RevealWinner } from '@tapas/ui';
import styles from './reveal-view.module.css';

const names = (winners: readonly RevealWinner[]) => winners.map((w) => w.name).join(' & ');

/**
 * The reveal as the PARTICIPANT draws it. Forked from `@tapas/ui`'s `RevealView`,
 * which is now the host's alone: the two apps became different products with
 * different visual languages, so they no longer share a renderer. This copy is
 * deliberately identical to the host's for now — the participant restyle is a
 * separate change, and splitting and restyling in one step would leave nothing
 * able to say which of the two broke the promise below.
 *
 * `RevealData` is still imported rather than redeclared. The shape is what has
 * to agree; the drawing is what is allowed to differ.
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
 * Translation keys are given as FULL paths with English defaults, because
 * i18next answers a missing key by echoing the key itself — which, in a label,
 * is read aloud. The defaults are the safety net, not the plan.
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
