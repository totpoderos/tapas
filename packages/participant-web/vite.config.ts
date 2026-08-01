import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Preloads the one webfont this app ships.
 *
 * Without it the browser learns the font exists only once it has fetched and
 * parsed the stylesheet — HTML, then CSS, then font, three round trips deep
 * before a cook at a venue sees a letter in the face the design is set in. The
 * preload starts it alongside the CSS instead.
 *
 * It has to be a plugin because the filename carries a content hash that only
 * exists after the bundle is built. `crossorigin` is not optional and not
 * decoration: fonts are fetched in CORS mode even from the same origin, and a
 * preload whose mode does not match the eventual fetch is downloaded twice.
 *
 * There is no bundle in dev, so this does nothing there — the dev server has
 * the file a few milliseconds away.
 */
function preloadTheWebfont(): Plugin {
  return {
    name: 'tapas:preload-the-webfont',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const font = Object.keys(ctx.bundle ?? {}).find((file) => file.endsWith('.woff2'));
        if (!font) return [];
        return [
          {
            tag: 'link',
            attrs: {
              rel: 'preload',
              as: 'font',
              type: 'font/woff2',
              href: `/${font}`,
              crossorigin: '',
            },
            injectTo: 'head',
          },
        ];
      },
    },
  };
}

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
  plugins: [react(), preloadTheWebfont()],
  server: { port: 5174, host: true, proxy },
  preview: { port: 4174, proxy },
});
