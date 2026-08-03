import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // .vercel holds a platform's build output — bundled, minified, and none of ours.
    ignores: ['**/dist/**', '**/build/**', '**/node_modules/**', '**/coverage/**', '**/.vercel/**', '**/serverless/bundle.js', '**/migrations.generated.ts'],
  },
  ...tseslint.configs.recommended,
  {
    // Honour the leading-underscore convention for intentionally-unused bindings.
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    /*
     * The API's data path is asynchronous, and a forgotten `await` there is the
     * one defect the test suite cannot see: SQLite answers inside the same tick,
     * so an un-awaited write still lands and every spec passes — and the same
     * code loses the write against a database reached over a network. Type-aware
     * linting is the only thing that catches it, so it is scoped to where it
     * matters rather than paid for everywhere.
     */
    files: ['packages/api/src/**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  {
    // Temporary, for the async conversion: removes awaits on things that were
    // never promises. Auto-fixable, which is the point.
    files: ['packages/api/tests/**/*.ts', 'packages/mcp/tests/**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: { '@typescript-eslint/await-thenable': 'error' },
  },
  {
    // The domain SOURCE must stay pure: no I/O, no infrastructure.
    // (Tests may use node built-ins, e.g. loading feature files.)
    // This is an enforced rule, not a convention (design.md §4A.4).
    files: ['packages/domain/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'node:*',
                'fs',
                'path',
                'net',
                'http',
                'https',
                'crypto',
                'fastify',
                'better-sqlite3',
                '@tapas/api',
                '@tapas/mcp',
                '@tapas/shared',
              ],
              message:
                'The domain package is pure: no I/O, no infrastructure, no framework imports.',
            },
          ],
        },
      ],
    },
  },
);
