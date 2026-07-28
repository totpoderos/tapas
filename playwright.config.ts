import { defineConfig, devices } from '@playwright/test';

/**
 * Whole-system E2E (design.md §11A.6). Playwright boots a real API (in-memory
 * SQLite) and the host app (Vite), and drives Chromium against them. The host
 * app is served same-origin and proxies API paths to the backend, so the
 * session cookie is first-party — exactly the shape the browser sees in
 * production behind a single edge. axe-core gates accessibility from slice one.
 */
const API_PORT = 3100;
const WEB_PORT = 5173;

const API_ENV = [
  // `development`, not `test`, because that is genuinely what this stack is: two
  // Vite servers and the API, all over plain HTTP on localhost. The session
  // cookie's transport follows the environment (see `cookieTransportFor`), and
  // marking it `Secure` here would be a lie the browser is right to act on —
  // WebKit drops such a cookie over HTTP, which is the very defect these tests
  // now exist to catch. Only `NODE_ENV` differs; nothing else keys off it except
  // the HTTPS redirect, which is production-only either way.
  'NODE_ENV=development',
  `API_PORT=${API_PORT}`,
  'DATABASE_PATH=:memory:',
  'JWT_SECRET=test-secret-that-is-at-least-32-characters',
  `HOST_WEB_ORIGIN=http://localhost:${WEB_PORT}`,
  'PARTICIPANT_WEB_ORIGIN=http://localhost:5174',
  'LLM_BASE_URL=http://localhost:11434/v1',
  'LLM_API_KEY=',
  'LLM_MODEL=llama3.1',
  // Many logins from one host across the suite; raise the per-IP login ceiling.
  'RATE_LIMIT_SENSITIVE_MAX=1000',
  // Drive the assistant with a deterministic keyword stub — no live model needed
  // headless. The chat-panel E2E steers it by what it types (see the stub client).
  'ASSISTANT_STUB=1',
].join(' ');

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'line' : [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'on-first-retry',
  },
  /*
   * Two engines, deliberately. A Safari-only defect reached a real device
   * because this matrix was Chromium alone: the session cookie was marked
   * `Secure` unconditionally, which Safari refuses to keep over plain HTTP
   * (Chrome makes an exception for localhost, Safari makes none), so a
   * participant joined and could then do nothing. Chromium could never have
   * caught it.
   *
   * WebKit runs the participant journey rather than the whole suite: the
   * participant app is the mobile-first one, used at a venue on whatever phone
   * people brought, and on iOS every browser is WebKit underneath. That is where
   * a browser difference actually costs someone their evening. Widening this to
   * the host app is worthwhile, but it should be a deliberate step with its own
   * fixing of whatever it surfaces — not a silent doubling of the gate.
   */
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'webkit-participant',
      use: { ...devices['iPhone 13'] },
      testMatch: /participant-.*\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: `${API_ENV} npm run start -w @tapas/api`,
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `API_PROXY_TARGET=http://localhost:${API_PORT} npm run dev -w @tapas/host-web`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      // The participant app, on 5174, same-origin-proxied to the API (first-party
      // voter cookie). Participant specs use full http://localhost:5174 URLs since
      // the shared baseURL points at the host app.
      command: `API_PROXY_TARGET=http://localhost:${API_PORT} npm run dev -w @tapas/participant-web`,
      url: 'http://localhost:5174',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
