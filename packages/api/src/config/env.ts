import { z } from 'zod';

// The committed dev/example default secrets. They keep the app booting locally,
// but they are public (in this repo), so the app REFUSES to boot in production
// if any of them is still in use — threat-model gaps G1/G2 (docs/threat-model.md).
const ASSISTANT_CONFIRMATION_DEV_DEFAULT = 'dev-assistant-confirmation-secret-change-me';
/**
 * The committed development address of whoever administers a deployment. Not a
 * secret — an email address never is — but leaving it in place in production
 * would mean the deployment could be claimed by whoever holds *this* inbox, so
 * it is rejected there exactly as the dev secrets are.
 */
const ADMIN_BOOTSTRAP_DEV_DEFAULT = 'admin@example.com';
/**
 * Development points at a local mail catcher. Nothing needs to be running for
 * the app to work: with no catcher up, every invitation's handoff fails and the
 * link comes back in the response — which is the same path an administrator
 * takes when production's mail server is down, so the fallback is the feature
 * rather than a development-only branch.
 */
const MAIL_DEV_HOST = 'localhost';
const MAIL_DEV_FROM = 'no-reply@tapas.example';
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
    /*
     * Which database serves this deployment.
     *
     * `sqlite` needs nothing installed, which is why it is the default and why
     * running this for the first time requires no setup. `postgres` is for a
     * deployment that cannot keep a disk — it reads DATABASE_URL and ignores
     * DATABASE_PATH. Anything else is refused here rather than discovered on
     * the first write.
     */
    DATABASE_DRIVER: z.enum(['sqlite', 'postgres']).default('sqlite'),
    DATABASE_PATH: z.string().min(1).default('./tapas.sqlite'),
    DATABASE_URL: z.string().default(''),
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
    // Names who may claim an unclaimed deployment and become its one
    // administrator. Pinning it here is what makes claiming safe: the
    // invitation link only proves its recipient holds the inbox they typed,
    // which at first run would be their own.
    ADMIN_BOOTSTRAP_EMAIL: z
      .string()
      .email('ADMIN_BOOTSTRAP_EMAIL must be an email address')
      .default(ADMIN_BOOTSTRAP_DEV_DEFAULT),
    /*
     * How this deployment hands an invitation over.
     *
     * `smtp` sends it. `none` says there is no mail server and the
     * administrator will pass the link on themselves — which the invitation
     * flow already supports, because the link comes back whenever a send fails.
     * Saying so is what makes it a deployment's choice rather than a broken
     * mail server: the link is offered at once instead of after a connection
     * times out, and production stops insisting on settings that would go
     * unused.
     */
    MAIL_TRANSPORT: z.enum(['smtp', 'none']).default('smtp'),
    // Where mail goes when there is mail to send. The defaults point at a local
    // catcher; production must name a real server (enforced below) unless it
    // has said it sends none.
    MAIL_HOST: z.string().min(1).default(MAIL_DEV_HOST),
    MAIL_PORT: z.coerce.number().int().positive().default(1025),
    // Not `z.coerce.boolean()`: that reads the string "false" as true, so
    // MAIL_SECURE=false would turn implicit TLS on.
    MAIL_SECURE: z
      .union([z.boolean(), z.string()])
      .default(false)
      .transform((value) => value === true || value === 'true'),
    MAIL_USER: z.string().default(''),
    MAIL_PASSWORD: z.string().default(''),
    MAIL_FROM: z.string().email('MAIL_FROM must be an email address').default(MAIL_DEV_FROM),
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
    /*
     * A production deployment pointed at a local catcher can never invite
     * anyone, and would only say so on the first invite, weeks later. Checked
     * only when there is meant to be a mail server: a deployment that has said
     * it sends none is not misconfigured, and holding it to settings it will
     * never read would push people into inventing plausible-looking ones — a
     * fail-fast worth lying to is a fail-fast that has stopped working.
     */
    if (env.MAIL_TRANSPORT === 'smtp' && env.MAIL_HOST === MAIL_DEV_HOST) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MAIL_HOST'],
        message: 'MAIL_HOST must name a real mail server in production (mail is the only way to invite anyone)',
      });
    }
    if (env.MAIL_TRANSPORT === 'smtp' && env.MAIL_FROM === MAIL_DEV_FROM) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MAIL_FROM'],
        message: 'MAIL_FROM must be overridden in production (the committed dev default is not allowed)',
      });
    }
    if (env.DATABASE_DRIVER === 'postgres' && env.DATABASE_URL.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL is required when DATABASE_DRIVER is postgres',
      });
    }
    if (env.ADMIN_BOOTSTRAP_EMAIL === ADMIN_BOOTSTRAP_DEV_DEFAULT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ADMIN_BOOTSTRAP_EMAIL'],
        message:
          'ADMIN_BOOTSTRAP_EMAIL must be overridden in production (the committed dev default is not allowed)',
      });
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
