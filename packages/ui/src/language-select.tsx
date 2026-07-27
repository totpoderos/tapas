import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from './i18n';
import styles from './language-select.module.css';

/**
 * The language selector, fixed to the corner so it rides along on every screen
 * (like the theme toggle, which it sits beside). A real <select> named by an
 * aria-label so it's keyboard-operable and announced; the globe is decorative,
 * and each language names itself in its own language. Changing it switches the
 * whole app at once (i18next re-renders every translated component) and the
 * choice is remembered (see createI18n). The label is translated too, so it
 * reads in whatever language is current.
 */
export function LanguageSelect() {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage ?? i18n.language;

  function change(event: ChangeEvent<HTMLSelectElement>) {
    void i18n.changeLanguage(event.target.value);
  }

  return (
    <span className={styles.field}>
      <span aria-hidden="true" className={styles.globe}>
        🌐
      </span>
      <select
        className={styles.select}
        value={current}
        onChange={change}
        aria-label={t('language.label')}
      >
        {LANGUAGES.map((language) => (
          <option key={language.code} value={language.code}>
            {language.label}
          </option>
        ))}
      </select>
    </span>
  );
}
