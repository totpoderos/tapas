import { z } from 'zod';

/**
 * Environment for the MCP server. Validated at startup (fail-fast). The server
 * speaks the protocol over stdio and acts as exactly one host, so it needs that
 * host's personal access token and the secret that keys destructive-action
 * confirmations — both required, no insecure defaults.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_BASE_URL: z.string().url().default('http://localhost:3000'),
  /** The host-issued personal access token this server connection acts as. */
  MCP_HOST_TOKEN: z.string().min(1),
  /** Secret keying the destructive-action confirmation HMAC (design.md §7.1). */
  MCP_CONFIRMATION_SECRET: z.string().min(32),
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
