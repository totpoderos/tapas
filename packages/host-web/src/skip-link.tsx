import { useTranslation } from 'react-i18next';

/**
 * The "skip to main" link (off-screen until focused). A component, not inline
 * markup, so its text re-renders when the language changes.
 */
export function SkipLink() {
  const { t } = useTranslation();
  return (
    <a href="#main" className="tp-skip">
      {t('common.skipToContent')}
    </a>
  );
}
