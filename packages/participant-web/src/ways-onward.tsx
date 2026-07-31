import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import styles from './ways-onward.module.css';

/** The steps a joined participant can be on. */
export type Step = 'dish' | 'score' | 'reveal';

/**
 * The dish form has no address of its own — it is the `joined` step of the join
 * route, which recognises the device and lands there.
 */
const PATH: Record<Step, string> = { dish: '/', score: '/score', reveal: '/reveal' };
/**
 * FULL key paths, with English defaults. The apps nest each locale file under its
 * own key, so a bare `waysOnward.dish` resolves to nothing and i18next answers by
 * echoing the key — which lands in the link text and the nav's accessible name.
 * That has shipped here before (`LanguageSelect` announcing "language.label").
 */
const LABEL: Record<Step, readonly [string, string]> = {
  dish: ['common.waysOnward.dish', 'The dishes'],
  score: ['common.waysOnward.score', 'Your scores'],
  reveal: ['common.waysOnward.reveal', 'The results'],
};

const ORDER: readonly Step[] = ['dish', 'score', 'reveal'];

/**
 * The ways on from wherever a participant is.
 *
 * One component deciding this, rather than each screen knowing about one
 * specific next screen, is the point: `/score` and `/reveal` carried no links at
 * all, so a participant who arrived by the back button or a reload was stranded
 * with only the browser's own controls. A screen that forgets a link is the same
 * defect again, so no screen is trusted to remember.
 *
 * Every other step is offered — a participant may go back to check what they
 * scored, or look at the dishes again, and moving between steps is theirs to
 * choose. Nothing here sends them anywhere on its own.
 */
export function WaysOnward({ from }: { from: Step }) {
  const { t } = useTranslation();
  const others = ORDER.filter((step) => step !== from);

  return (
    <nav className={styles.ways} aria-label={t('common.waysOnward.label', 'Go to')}>
      {others.map((step) => (
        <Link key={step} to={PATH[step]} className={styles.way}>
          {t(LABEL[step][0], LABEL[step][1])}
        </Link>
      ))}
    </nav>
  );
}
