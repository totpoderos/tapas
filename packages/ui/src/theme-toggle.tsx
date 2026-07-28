import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { applyTheme, currentTheme, type Theme } from './theme';
import styles from './theme-toggle.module.css';

/**
 * A single control, fixed to the corner so it rides along on every screen, that
 * flips the app between light and dark. A real <button> with a descriptive label
 * ("Switch to dark theme") so it's announced and keyboard-operable; the icon is
 * decorative. The label and icon name the theme you'd switch *to*, which is the
 * action, so screen-reader and sighted visitors hear/see the same thing.
 *
 * The label is translated, like {@link LanguageSelect}'s: the consuming app
 * supplies `common.theme.switchToDark` / `switchToLight`. The English text is
 * the fallback, so a host that has not (yet) added the keys still reads sensibly
 * rather than showing a raw key.
 */
export function ThemeToggle() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  function toggle() {
    applyTheme(next);
    setTheme(next);
  }

  const label =
    next === 'dark'
      ? t('common.theme.switchToDark', 'Switch to dark theme')
      : t('common.theme.switchToLight', 'Switch to light theme');

  return (
    <button type="button" className={styles.toggle} onClick={toggle} aria-label={label} title={label}>
      <span aria-hidden="true">{next === 'dark' ? '☾' : '☀'}</span>
    </button>
  );
}
