import i18next, { type i18n as I18n, type Resource } from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

/*
 * The one place that defines which languages the apps offer. Adding a language
 * later is: author its translation resources, then add a line here — no screen
 * or component changes (internationalization spec: "Adding a language does not
 * change the screens").
 */
export interface Language {
  /** BCP 47 tag, also the <html lang> value and the locale-resource key. */
  readonly code: string;
  /** How the language names itself, for the selector (its own language). */
  readonly label: string;
}

export const LANGUAGES: readonly Language[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
];

const SUPPORTED = LANGUAGES.map((language) => language.code);
const FALLBACK = 'en';

/** localStorage key holding a visitor's explicit choice (shared by both apps). */
export const LANGUAGE_STORAGE_KEY = 'tapas.lang';

/**
 * Build an i18next instance for an app from its own translation resources
 * (one namespace, "translation"). Language is resolved in this order — the
 * visitor's remembered choice, then the browser, then English — and a new
 * choice is remembered in localStorage. The document's `lang` attribute is
 * kept in step so assistive technology pronounces the page correctly.
 */
export function createI18n(resources: Resource): I18n {
  const instance = i18next.createInstance();

  instance
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      supportedLngs: SUPPORTED,
      fallbackLng: FALLBACK,
      // Only the base tag matters (es, not es-ES) — we don't ship regional variants.
      load: 'languageOnly',
      nonExplicitSupportedLngs: true,
      detection: {
        order: ['localStorage', 'navigator'],
        lookupLocalStorage: LANGUAGE_STORAGE_KEY,
        caches: ['localStorage'],
      },
      interpolation: { escapeValue: false }, // React already escapes; values are static app text
      react: { useSuspense: false }, // resources are inline, so init is synchronous
    });

  const syncDocumentLang = (lng: string) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', lng.split('-')[0] ?? lng);
    }
  };
  syncDocumentLang(instance.resolvedLanguage ?? instance.language ?? FALLBACK);
  instance.on('languageChanged', syncDocumentLang);

  return instance;
}
