import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          // The evals package's *unit* tests belong to the hard gate — the
          // runner and metrics are ordinary deterministic code. The real-model
          // run is `npm run eval:creation`, never a test (design.md §11A.3).
          include: ['packages/{domain,shared,api,mcp,evals}/tests/**/*.{test,spec}.ts'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'web',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          include: ['packages/ui/tests/**/*.{test,spec}.{ts,tsx}'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'participant-web',
          environment: 'jsdom',
          globals: true,
          // Second setup bootstraps i18next (like the app entry), so participant
          // screens rendered directly in a test — not only via <App /> — resolve t().
          setupFiles: ['./vitest.setup.ts', './packages/participant-web/tests/setup.ts'],
          include: ['packages/participant-web/tests/**/*.{test,spec}.{ts,tsx}'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'host-web',
          environment: 'jsdom',
          globals: true,
          // Second setup bootstraps i18next (like the app entry), so host pages
          // rendered directly in a test — not only via <App /> — resolve t().
          setupFiles: ['./vitest.setup.ts', './packages/host-web/tests/setup.ts'],
          include: ['packages/host-web/tests/**/*.{test,spec}.{ts,tsx}'],
        },
      },
    ],
  },
});
