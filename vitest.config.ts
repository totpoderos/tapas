import { defineConfig } from 'vitest/config';

// Node-side tests (domain, shared, api, mcp). The frontend (jsdom) project
// is added as a Vitest workspace when the frontends land (Phase 5).
export default defineConfig({
  test: {
    include: ['packages/{domain,shared,api,mcp}/**/*.{test,spec}.ts'],
    environment: 'node',
  },
});
