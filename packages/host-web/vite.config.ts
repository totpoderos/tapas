import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In dev and preview the host app is served same-origin and forwards API paths
// to the backend, so the session cookie stays first-party (no CORS, no token in
// JS). Point it at a different API with API_PROXY_TARGET (used by the E2E run).
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';
const proxy = {
  '/auth': { target: apiTarget, changeOrigin: true },
  '/drafts': { target: apiTarget, changeOrigin: true },
  '/contests': { target: apiTarget, changeOrigin: true },
  '/assistant': { target: apiTarget, changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
});
