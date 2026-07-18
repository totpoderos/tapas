import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// PWA (installable, service worker) is added in Phase 5C — the participant app
// is mobile-first and PWA-installable per the design.
export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
});
