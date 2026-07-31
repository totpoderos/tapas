import { useTranslation } from 'react-i18next';
import type { RevealData, RevealWinner } from '@tapas/ui';
import styles from './reveal-view.module.css';

const names = (winners: readonly RevealWinner[]) => winners.map((w) => w.name).join(' & ');

/** Everyone who brought a winning dish, across joint winners, without repeats. */
const cooksOf = (winners: readonly RevealWinner[]) => [
  ...new Set(winners.flatMap((winner) => winner.cooks ?? [])),
];

/**
 * The reveal as the PARTICIPANT draws it (screen 12). Forked from `@tapas/ui`'s
 * `RevealView`, which is now the host's alone: the two apps became different
 * products with different visual languages, so they no longer share a renderer.
 *
 * The two now differ in what they lead with, and that is the point of the fork.
 * The host's screen is a workspace and leads with "Winner"; this one is the
 * moment of the evening, so the winning DISH is the headline and the cook is
 * named under it — the result names a person as well as a plate. The rank
 * numeral carries the moment where a trophy used to.
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
  const cooks = cooksOf(reveal.overall.winners);

  return (
    <div className={styles.reveal} aria-live="polite">
      <p className={styles.kicker}>{reveal.contestName}</p>

      {/*
        * The rank numeral, where the trophy was. It is decoration and says
        * nothing a reader needs, so it is hidden from assistive technology —
        * the heading below carries the whole announcement.
        */}
      <p className={styles.rank} aria-hidden="true">
        1
      </p>

      <p className={styles.crown}>
        {joint ? t('reveal.jointWinners', 'Joint winners') : t('reveal.winner', 'Winner')}
      </p>

      {/*
        * The dish is the headline, and the h1. The host's screen puts the word
        * "Winner" in this position; on a phone at the table, the name of the
        * thing that won is what everyone is waiting to read.
        */}
      <h1 className={styles.title}>{names(reveal.overall.winners)}</h1>

      {cooks.length > 0 && (
        <p className={styles.cook}>
          {t('reveal.broughtBy', 'brought by {{cooks}}', { cooks: cooks.join(' & ') })}
        </p>
      )}

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
