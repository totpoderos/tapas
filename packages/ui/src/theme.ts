/*
 * Theme state for both frontends. The colour tokens already ship two themes —
 * light on :root, dark under prefers-color-scheme — and let a `data-theme`
 * attribute on <html> override the media query in both directions (tokens.css).
 * This module is the one place that reads and writes that choice, persisting it
 * so a host's preference survives navigation and reloads.
 */
export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'tapas.theme';

/** The theme the operating system asks for, when the host hasn't chosen one. */
export function systemTheme(): Theme {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/** The host's explicitly chosen theme, or null if they've never picked one. */
export function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null; // private mode / storage disabled — fall back to the system theme
  }
}

/** The theme currently in effect: the host's choice if any, else the system's. */
export function currentTheme(): Theme {
  return storedTheme() ?? systemTheme();
}

/** Force a theme now and remember it for next time. */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // best-effort: the attribute still applies for this session
  }
}

/**
 * Re-apply a previously chosen theme at startup, before React renders, so the
 * first paint is already in the right theme (no flash). A host who has never
 * chosen keeps following the system theme via the media query — untouched.
 */
export function initTheme(): void {
  const chosen = storedTheme();
  if (chosen) document.documentElement.setAttribute('data-theme', chosen);
}
