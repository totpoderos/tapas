import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadEnv } from '../../../src/config/env.js';

const STRONG_SECRET = 'a-strong-secret-that-is-plenty-long-enough';

describe('loadEnv', () => {
  it('applies defaults and accepts a valid secret', () => {
    const env = loadEnv({ JWT_SECRET: STRONG_SECRET } as NodeJS.ProcessEnv);

    expect(env.NODE_ENV).toBe('development');
    expect(env.API_PORT).toBe(3000);
    expect(env.DATABASE_PATH).toBe('./tapas.sqlite');
    expect(env.LLM_BASE_URL).toBe('http://localhost:11434/v1');
    expect(env.LLM_API_KEY).toBe('');
    expect(env.LLM_MODEL).toBe('llama3.1');
  });

  it('coerces API_PORT to a number', () => {
    const env = loadEnv({ JWT_SECRET: STRONG_SECRET, API_PORT: '4000' } as unknown as NodeJS.ProcessEnv);
    expect(env.API_PORT).toBe(4000);
  });

  it('fails fast when a required secret is missing', () => {
    expect(() => loadEnv({} as NodeJS.ProcessEnv)).toThrow(EnvValidationError);
  });

  it('refuses to boot when the administrator address is not an address', () => {
    expect(() =>
      loadEnv({
        JWT_SECRET: STRONG_SECRET,
        ADMIN_BOOTSTRAP_EMAIL: 'not-an-address',
      } as NodeJS.ProcessEnv),
    ).toThrow(EnvValidationError);
  });

  // z.coerce.boolean() reads any non-empty string as true, so MAIL_SECURE=false
  // would have switched implicit TLS on — an env var meaning its own opposite.
  it('reads MAIL_SECURE=false as false', () => {
    const env = loadEnv({
      JWT_SECRET: STRONG_SECRET,
      MAIL_SECURE: 'false',
    } as unknown as NodeJS.ProcessEnv);
    expect(env.MAIL_SECURE).toBe(false);
  });

  it('reads MAIL_SECURE=true as true', () => {
    const env = loadEnv({
      JWT_SECRET: STRONG_SECRET,
      MAIL_SECURE: 'true',
    } as unknown as NodeJS.ProcessEnv);
    expect(env.MAIL_SECURE).toBe(true);
  });

  // Threat-model G2: a short signing key is brute-forceable.
  it('rejects a JWT_SECRET shorter than 32 characters', () => {
    expect(() => loadEnv({ JWT_SECRET: 'too-short' } as NodeJS.ProcessEnv)).toThrow(EnvValidationError);
  });

  // Threat-model G1: the committed dev default keys the destructive-action HMAC.
  describe('production secret hardening', () => {
    const base = {
      NODE_ENV: 'production',
      JWT_SECRET: STRONG_SECRET,
      HOST_WEB_ORIGIN: 'https://host.example.com',
      PARTICIPANT_WEB_ORIGIN: 'https://app.example.com',
      ADMIN_BOOTSTRAP_EMAIL: 'operator@example.com',
      MAIL_HOST: 'smtp.example.com',
      MAIL_FROM: 'no-reply@sobremesa.es',
    } as unknown as NodeJS.ProcessEnv;

    it('refuses to boot when ASSISTANT_CONFIRMATION_SECRET is still the committed dev default', () => {
      // Not set -> falls back to the committed default -> must be rejected in prod.
      expect(() => loadEnv(base)).toThrow(EnvValidationError);
    });

    it('refuses to boot when JWT_SECRET is a known committed default', () => {
      expect(() =>
        loadEnv({
          ...base,
          JWT_SECRET: 'dev-jwt-secret-change-me-padded-to-thirty-two',
          ASSISTANT_CONFIRMATION_SECRET: STRONG_SECRET + '-x',
        } as NodeJS.ProcessEnv),
      ).not.toThrow(); // control: a non-default 32+ secret is fine
      expect(() =>
        loadEnv({ ...base, JWT_SECRET: 'dev-jwt-secret-change-me' } as NodeJS.ProcessEnv),
      ).toThrow(EnvValidationError); // the known default (also <32) is rejected
    });

    it('boots when production secrets are properly overridden', () => {
      const env = loadEnv({
        ...base,
        ASSISTANT_CONFIRMATION_SECRET: 'a-real-production-assistant-secret-value',
      } as NodeJS.ProcessEnv);
      expect(env.NODE_ENV).toBe('production');
    });

    // The address that may claim the deployment. Not a secret, but leaving the
    // committed one in place would hand the deployment to whoever holds that inbox.
    it('refuses to boot when ADMIN_BOOTSTRAP_EMAIL is still the committed dev default', () => {
      const { ADMIN_BOOTSTRAP_EMAIL: _omitted, ...withoutIt } = base as Record<string, string>;
      expect(() =>
        loadEnv({
          ...withoutIt,
          ASSISTANT_CONFIRMATION_SECRET: STRONG_SECRET + '-x',
        } as unknown as NodeJS.ProcessEnv),
      ).toThrow(EnvValidationError);
    });

    it('boots when the administrator address is a real one', () => {
      const env = loadEnv({
        ...base,
        ASSISTANT_CONFIRMATION_SECRET: STRONG_SECRET + '-x',
      } as NodeJS.ProcessEnv);
      expect(env.ADMIN_BOOTSTRAP_EMAIL).toBe('operator@example.com');
    });

    // Mail is the only route to a host account, so a production deployment that
    // cannot send is one where nobody can ever be invited — and it would only
    // say so on the first invite, weeks after deploy.
    it('refuses to boot in production while mail still points at a local catcher', () => {
      const { MAIL_HOST: _omitted, ...withoutIt } = base as Record<string, string>;
      expect(() =>
        loadEnv({
          ...withoutIt,
          ASSISTANT_CONFIRMATION_SECRET: STRONG_SECRET + '-x',
        } as unknown as NodeJS.ProcessEnv),
      ).toThrow(EnvValidationError);
    });

    it('refuses to boot in production with the committed sender address', () => {
      const { MAIL_FROM: _omitted, ...withoutIt } = base as Record<string, string>;
      expect(() =>
        loadEnv({
          ...withoutIt,
          ASSISTANT_CONFIRMATION_SECRET: STRONG_SECRET + '-x',
        } as unknown as NodeJS.ProcessEnv),
      ).toThrow(EnvValidationError);
    });

    /*
     * A deployment that has said it sends no mail is not misconfigured — the
     * invitation flow answers a failed send with the link, and the screen
     * already shows it. Holding it to mail settings it will never read would
     * push people into inventing plausible-looking ones, and a fail-fast worth
     * lying to is a fail-fast that has stopped working.
     */
    it('boots in production with no mail settings when it sends no mail', () => {
      const { MAIL_HOST: _host, MAIL_FROM: _from, ...withoutMail } = base as Record<string, string>;
      const env = loadEnv({
        ...withoutMail,
        MAIL_TRANSPORT: 'none',
        ASSISTANT_CONFIRMATION_SECRET: STRONG_SECRET + '-x',
      } as unknown as NodeJS.ProcessEnv);
      expect(env.MAIL_TRANSPORT).toBe('none');
    });

    // The relaxation is scoped to that one answer, not to anything mail-shaped.
    it('still refuses a local catcher when it does mean to send', () => {
      const { MAIL_HOST: _host, ...withoutHost } = base as Record<string, string>;
      expect(() =>
        loadEnv({
          ...withoutHost,
          MAIL_TRANSPORT: 'smtp',
          ASSISTANT_CONFIRMATION_SECRET: STRONG_SECRET + '-x',
        } as unknown as NodeJS.ProcessEnv),
      ).toThrow(EnvValidationError);
    });

    it('refuses a transport that is neither sending nor not sending', () => {
      expect(() =>
        loadEnv({
          ...base,
          MAIL_TRANSPORT: 'maybe',
          ASSISTANT_CONFIRMATION_SECRET: STRONG_SECRET + '-x',
        } as unknown as NodeJS.ProcessEnv),
      ).toThrow(EnvValidationError);
    });

    it('still allows the dev default outside production', () => {
      // NODE_ENV defaults to development -> the committed default is allowed.
      expect(() => loadEnv({ JWT_SECRET: STRONG_SECRET } as NodeJS.ProcessEnv)).not.toThrow();
    });
  });
});
