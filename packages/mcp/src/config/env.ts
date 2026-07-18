import { z } from 'zod';

/** Environment for the MCP server. Validated at startup (fail-fast). */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MCP_PORT: z.coerce.number().int().positive().default(3001),
  API_BASE_URL: z.string().url().default('http://localhost:3000'),
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
