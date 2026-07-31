import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './tokens.css';
import './participant.css';
import './i18n'; // initialise i18next before the first render
import { App } from './app';
import { SkipLink } from './skip-link';

/*
 * No `initTheme()` and no `ThemeToggle`. This app is light only: the handoff
 * carries no dark values, and glass over cream does not invert mechanically.
 *
 * The pinning is done in tokens.css — `color-scheme: light` with no dark block
 * at all — rather than by forcing a `data-theme` attribute here. Nothing in this
 * app's stylesheet answers to a dark preference any more, so there is nothing
 * left to override, and an attribute would only be a note to a reader.
 *
 * The language control moved into the header (see nav.tsx). It used to be fixed
 * to the corner of the viewport, which on a phone means sitting on top of the
 * screen's own content.
 */
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <SkipLink />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
}
