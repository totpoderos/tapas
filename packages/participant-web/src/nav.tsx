import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageChoice } from './language-choice';
import styles from './nav.module.css';

/**
 * The header bar every participant screen carries: the product on the left,
 * where you are on the right.
 *
 * It always renders the language choice. The handoff draws that control only on
 * the screens before joining, and gives the joined screens the participant's
 * name in the same place — but `internationalization` requires a language
 * selector on *every* screen, and that is a shipped promise with tests behind
 * it. So both are here, and the control takes its narrow form once there is a
 * name beside it. Dropping the requirement would be a change to what the
 * product offers, not a restyle, and it is not this change's to make.
 */
export function Nav({ context }: { context?: ReactNode }) {
  const { t } = useTranslation();

  return (
    <header className={styles.nav}>
      <span className={styles.brand}>
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.brandName}>{t('common.brand')}</span>
      </span>
      <span className={styles.right}>
        {context ? <span className={styles.context}>{context}</span> : null}
        <LanguageChoice compact={Boolean(context)} />
      </span>
    </header>
  );
}
