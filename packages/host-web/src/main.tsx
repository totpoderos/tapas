import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@tapas/ui/tokens.css';
import { ThemeToggle, initTheme } from '@tapas/ui';
import { App } from './app';
import { SessionProvider } from './auth/session';

initTheme(); // re-apply the host's chosen theme before first paint

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <a href="#main" className="tp-skip">
        Skip to content
      </a>
      <ThemeToggle />
      <BrowserRouter>
        <SessionProvider>
          <App />
        </SessionProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}
