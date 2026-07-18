import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadEnv } from '../../../src/config/env.js';

describe('loadEnv', () => {
  it('applies defaults and accepts a valid secret', () => {
    const env = loadEnv({ JWT_SECRET: 'dev-secret' } as NodeJS.ProcessEnv);

    expect(env.NODE_ENV).toBe('development');
    expect(env.API_PORT).toBe(3000);
    expect(env.DATABASE_PATH).toBe('./tapas.sqlite');
  });

  it('coerces API_PORT to a number', () => {
    const env = loadEnv({ JWT_SECRET: 'x', API_PORT: '4000' } as unknown as NodeJS.ProcessEnv);
    expect(env.API_PORT).toBe(4000);
  });

  it('fails fast when a required secret is missing', () => {
    expect(() => loadEnv({} as NodeJS.ProcessEnv)).toThrow(EnvValidationError);
  });
});
