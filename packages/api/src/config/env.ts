import { z } from 'zod';

/**
 * Environment schema for the API. Validated at startup (fail-fast): the
 * process refuses to boot on missing/invalid config (design.md §11B.3).
 * Secrets are never logged — only the offending keys/reasons are reported.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_PATH: z.string().min(1).default('./tapas.sqlite'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
});

export type Env = z.infer<typeof EnvSchema>;

export class EnvValidationError extends Error {}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new EnvValidationError(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
