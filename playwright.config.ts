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
  'NODE_ENV=test',
  `API_PORT=${API_PORT}`,
  'DATABASE_PATH=:memory:',
  'JWT_SECRET=test-secret-that-is-at-least-32-characters',
  `HOST_WEB_ORIGIN=http://localhost:${WEB_PORT}`,
  'PARTICIPANT_WEB_ORIGIN=http://localhost:5174',
  'LLM_BASE_URL=http://localhost:11434/v1',
  'LLM_API_KEY=',
  'LLM_MODEL=llama3.1',
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
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
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
  ],
});
