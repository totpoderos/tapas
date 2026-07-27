import { useState } from 'react';
import { applyTheme, currentTheme, type Theme } from './theme';
import styles from './theme-toggle.module.css';

/**
 * A single control, fixed to the corner so it rides along on every screen, that
 * flips the app between light and dark. A real <button> with a descriptive label
 * ("Switch to dark theme") so it's announced and keyboard-operable; the icon is
 * decorative. The label and icon name the theme you'd switch *to*, which is the
 * action, so screen-reader and sighted hosts hear/see the same thing.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  function toggle() {
    applyTheme(next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      <span aria-hidden="true">{next === 'dark' ? '☾' : '☀'}</span>
    </button>
  );
}
