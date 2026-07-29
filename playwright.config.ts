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
// The mail catcher. Started here rather than by a CI `services:` block so a
// local run and CI start it the same way — this slice exists partly because an
// untested path was allowed to diverge from a shipped one, and a CI-only
// service is that shape again.
const MAIL_SMTP_PORT = 1125;
const MAIL_API_PORT = 8125;

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
  // Real SMTP to a real catcher: the E2E exercises the transport that ships,
  // and reads the message the way its recipient would rather than reaching into
  // the database for a token hash.
  'MAIL_HOST=localhost',
  `MAIL_PORT=${MAIL_SMTP_PORT}`,
  'MAIL_FROM=no-reply@tapas.example',
  'ADMIN_BOOTSTRAP_EMAIL=e2e-operator@sobremesa.es',
].join(' ');

/** Where a spec reads what was sent. Exported so the mail helper agrees with the runner. */
export const MAILPIT_API = `http://localhost:${MAIL_API_PORT}`;

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
    /*
     * Claims the deployment once, before anything else runs.
     *
     * A deployment can be claimed exactly once, and the suite runs a single
     * in-memory API — so without this, every specification needing an
     * administrator had to crowd into the one file that did the claiming, and
     * a second file that also claimed would race it. Now any file may assume an
     * administrator exists and can live where its subject lives.
     *
     * It also owns the assertions about the *unclaimed* state, because that
     * state exists only until it claims. Nowhere else can see it.
     */
    { name: 'setup', testMatch: /claim-the-deployment\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testIgnore: /\.setup\.ts/,
    },
    {
      name: 'webkit-participant',
      use: { ...devices['iPhone 13'] },
      testMatch: /participant-.*\.spec\.ts/,
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      // Docker is a prerequisite for the E2E loop; see tests/e2e/README.md.
      command: `docker run --rm -p ${MAIL_SMTP_PORT}:1025 -p ${MAIL_API_PORT}:8025 axllent/mailpit:latest`,
      url: `${MAILPIT_API}/api/v1/info`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
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
