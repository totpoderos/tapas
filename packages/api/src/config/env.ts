import { z } from 'zod';

// The committed dev/example default secrets. They keep the app booting locally,
// but they are public (in this repo), so the app REFUSES to boot in production
// if any of them is still in use — threat-model gaps G1/G2 (docs/threat-model.md).
const ASSISTANT_CONFIRMATION_DEV_DEFAULT = 'dev-assistant-confirmation-secret-change-me';
// Committed dev/example values for the two secrets this schema owns; rejected in
// production below. (The JWT one is <32 chars, so the length floor also catches
// it — it is listed for an explicit, readable failure message.)
const KNOWN_INSECURE_SECRETS = new Set([
  ASSISTANT_CONFIRMATION_DEV_DEFAULT,
  'dev-jwt-secret-change-me',
  'dev-only-jwt-secret-change-me-in-production',
]);

/**
 * Environment schema for the API. Validated at startup (fail-fast): the
 * process refuses to boot on missing/invalid config (design.md §11B.3).
 * Secrets are never logged — only the offending keys/reasons are reported.
 */
const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_PATH: z.string().min(1).default('./tapas.sqlite'),
    // Keys the session-token HMAC. A short key is brute-forceable, so a real
    // length floor is enforced (threat-model G2); use 64+ random chars in prod.
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    HOST_WEB_ORIGIN: z.string().min(1).default('http://localhost:5173'),
    PARTICIPANT_WEB_ORIGIN: z.string().min(1).default('http://localhost:5174'),
    // Any OpenAI-compatible /chat/completions endpoint — a local Ollama by
    // default, or a hosted provider that mirrors the same API shape.
    LLM_BASE_URL: z.string().min(1).default('http://localhost:11434/v1'),
    LLM_API_KEY: z.string().default(''),
    LLM_MODEL: z.string().min(1).default('llama3.1'),
    // Keys the HMAC that gates the in-app assistant's destructive actions
    // (design.md §7.1). A dev default keeps the app booting; production must
    // override it (enforced below — threat-model G1).
    ASSISTANT_CONFIRMATION_SECRET: z.string().min(32).default(ASSISTANT_CONFIRMATION_DEV_DEFAULT),
    // Test-only: when 1, the assistant runs on a deterministic keyword stub instead
    // of a real model, so a headless E2E can drive it. Never set in production.
    ASSISTANT_STUB: z.coerce.number().int().default(0),
  })
  // In production, no secret may still be a publicly-known committed default.
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    for (const key of ['JWT_SECRET', 'ASSISTANT_CONFIRMATION_SECRET'] as const) {
      if (KNOWN_INSECURE_SECRETS.has(env[key])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} must be overridden in production (the committed dev default is not allowed)`,
        });
      }
    }
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
