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
  HOST_WEB_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  PARTICIPANT_WEB_ORIGIN: z.string().min(1).default('http://localhost:5174'),
  // Any OpenAI-compatible /chat/completions endpoint — a local Ollama by
  // default, or a hosted provider that mirrors the same API shape.
  LLM_BASE_URL: z.string().min(1).default('http://localhost:11434/v1'),
  LLM_API_KEY: z.string().default(''),
  LLM_MODEL: z.string().min(1).default('llama3.1'),
  // Keys the HMAC that gates the in-app assistant's destructive actions
  // (design.md §7.1). A dev default keeps the app booting; production overrides.
  ASSISTANT_CONFIRMATION_SECRET: z
    .string()
    .min(32)
    .default('dev-assistant-confirmation-secret-change-me'),
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
