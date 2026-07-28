import { useTranslation } from 'react-i18next';

/**
 * The skip-to-main link — the first tab stop on every screen. Split out of the
 * entry point so its text can be translated (a component may call `t()`, the
 * module-level render call may not).
 */
export function SkipLink() {
  const { t } = useTranslation();
  return (
    <a href="#main" className="tp-skip">
      {t('common.skipToContent')}
    </a>
  );
}
