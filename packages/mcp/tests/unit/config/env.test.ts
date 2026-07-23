import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadEnv } from '../../../src/config/env.js';

const VALID = {
  MCP_HOST_TOKEN: 'pat-abc',
  MCP_CONFIRMATION_SECRET: 'a-confirmation-secret-of-32-chars!!',
};

describe('mcp env', () => {
  it('loads with the required host token and confirmation secret, defaulting the API url', () => {
    const env = loadEnv(VALID);
    expect(env.MCP_HOST_TOKEN).toBe('pat-abc');
    expect(env.API_BASE_URL).toBe('http://localhost:3000');
  });

  it('fails fast without a host token', () => {
    expect(() => loadEnv({ MCP_CONFIRMATION_SECRET: VALID.MCP_CONFIRMATION_SECRET })).toThrow(
      EnvValidationError,
    );
  });

  it('rejects a confirmation secret that is too short to key an HMAC safely', () => {
    expect(() => loadEnv({ MCP_HOST_TOKEN: 'pat', MCP_CONFIRMATION_SECRET: 'short' })).toThrow(
      EnvValidationError,
    );
  });
});
