import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@tapas/ui/tokens.css';
import './participant.css';
import { LanguageSelect, ThemeToggle, initTheme } from '@tapas/ui';
import './i18n'; // initialise i18next before the first render
import { App } from './app';
import { SkipLink } from './skip-link';

initTheme(); // re-apply the guest's chosen theme before first paint

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <SkipLink />
      <LanguageSelect />
      <ThemeToggle />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
}
