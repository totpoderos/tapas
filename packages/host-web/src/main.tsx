import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@tapas/ui/tokens.css';
import { App } from './app';
import { SessionProvider } from './auth/session';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <a href="#main" className="tp-skip">
        Skip to content
      </a>
      <BrowserRouter>
        <SessionProvider>
          <App />
        </SessionProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}
