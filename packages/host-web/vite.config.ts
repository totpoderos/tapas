import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In dev and preview the host app is served same-origin and forwards API paths
// to the backend, so the session cookie stays first-party (no CORS, no token in
// JS). Point it at a different API with API_PROXY_TARGET (used by the E2E run).
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';
// Every prefix here is forwarded to the API, which means none of them can also
// be a page route: a browsable path under one of these is proxied away and
// answered by the backend. `/accept-invite` and the first-run screen are named
// deliberately clear of `/invites` and `/setup` for that reason.
const proxy = {
  '/auth': { target: apiTarget, changeOrigin: true },
  '/drafts': { target: apiTarget, changeOrigin: true },
  '/contests': { target: apiTarget, changeOrigin: true },
  '/assistant': { target: apiTarget, changeOrigin: true },
  '/admin': { target: apiTarget, changeOrigin: true },
  '/invites': { target: apiTarget, changeOrigin: true },
  '/setup': { target: apiTarget, changeOrigin: true },
};

/*
 * `host: true` binds the dev server to every interface rather than to localhost,
 * so another device on the same network can open it — usually to drive a contest
 * from a laptop while a phone plays the participant side, which is the only way
 * to see both halves of an evening at once.
 *
 * See participant-web's config for the fuller note: this is a development
 * convenience, it inherits whatever the local network is, and it is not a
 * production path.
 */
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true, proxy },
  preview: { port: 4173, proxy },
});
