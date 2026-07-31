import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '@tapas/ui';
import styles from './language-choice.module.css';

/**
 * Choosing the interface language, as the segmented control the handoff puts in
 * the header. This app's own; `@tapas/ui`'s `LanguageSelect` stays the host
 * panel's, which has room for a corner-fixed <select> and a desk to read it on.
 *
 * `LANGUAGES` is still imported from `@tapas/ui` — it is the list of languages
 * the product offers, not a way of drawing them, and `internationalization`
 * promises that adding one changes no screen. Two copies of that list would
 * break the promise the first time they disagreed.
 *
 * `compact` narrows the options to their codes for the joined screens, where the
 * header's right-hand side is also carrying who the participant is. The
 * accessible name stays the full language in both forms, because "ES" read
 * aloud is a pair of letters and "Español" is an answer.
 */
export function LanguageChoice({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage ?? i18n.language;

  return (
    <fieldset className={`${styles.seg} ${compact ? styles.compact : ''}`}>
      <legend className={styles.legend}>{t('common.language.label', 'Language')}</legend>
      <div className={styles.opts}>
        {LANGUAGES.map((language) => (
          <label key={language.code} className={styles.opt}>
            <input
              className={styles.input}
              type="radio"
              name="language"
              value={language.code}
              checked={language.code === current}
              onChange={() => void i18n.changeLanguage(language.code)}
              /* The name is the language, however little of it is drawn. */
              aria-label={language.label}
            />
            <span aria-hidden="true">
              {compact ? language.code.toUpperCase() : language.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
