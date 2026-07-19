import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/build/**', '**/node_modules/**', '**/coverage/**'],
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
