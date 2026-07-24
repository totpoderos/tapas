import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The participant app is served same-origin and forwards API paths to the
// backend, so the `Secure;SameSite=None` voter cookie stays first-party (no
// CORS, no token in JS). Point it at a different API with API_PROXY_TARGET
// (used by the E2E run). PWA install/offline (service worker + manifest) lands
// in a later sub-slice — this slice is the join flow.
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';
const proxy = {
  '/contests': { target: apiTarget, changeOrigin: true },
  '/health': { target: apiTarget, changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5174, proxy },
  preview: { port: 4174, proxy },
});
