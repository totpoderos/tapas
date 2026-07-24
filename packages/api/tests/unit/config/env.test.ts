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

    it('still allows the dev default outside production', () => {
      // NODE_ENV defaults to development -> the committed default is allowed.
      expect(() => loadEnv({ JWT_SECRET: STRONG_SECRET } as NodeJS.ProcessEnv)).not.toThrow();
    });
  });
});
