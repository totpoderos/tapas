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

/*
 * `host: true` binds the dev server to every interface rather than to localhost,
 * so a phone on the same network can open it. This app is the one that most
 * needs it: it is designed for a phone at a venue, and a simulator is not a
 * phone — thumb reach, the score track's drag, and Safari's own cookie rules are
 * only really testable on the real thing.
 *
 * It is a development convenience and nothing more. It listens on the local
 * network, so it inherits whatever that network is: on shared or public wifi it
 * makes the dev server, and the API it proxies to, reachable by anyone on it.
 * Nothing here is a production path — production is built, served elsewhere, and
 * governed by `https-redirect.ts` and the deployed cookie transport.
 *
 * Requests still ride the proxy below, so a phone talks only to this origin and
 * the session cookie stays first-party. That is also why the API must stay in
 * `development`: `cookieTransportFor` only drops `Secure` there, and Safari
 * refuses a `Secure` cookie from an insecure origin with no localhost exception.
 */
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, host: true, proxy },
  preview: { port: 4174, proxy },
});
