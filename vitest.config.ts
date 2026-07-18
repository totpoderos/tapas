import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['packages/{domain,shared,api,mcp}/tests/**/*.{test,spec}.ts'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'web',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          include: ['packages/{ui,host-web,participant-web}/tests/**/*.{test,spec}.{ts,tsx}'],
        },
      },
    ],
  },
});
