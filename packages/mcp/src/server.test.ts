import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildServer } from './server.js';

afterEach(() => vi.unstubAllGlobals());

describe('mcp server', () => {
  it('health reports its own status and the reachable API status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ json: async () => ({ status: 'ok' }) })),
    );

    const app = buildServer('http://api.test');
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', api: 'ok', tools: 0 });

    await app.close();
  });

  it('reports the API as unreachable when it cannot be contacted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connection refused');
      }),
    );

    const app = buildServer('http://api.test');
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.json()).toMatchObject({ status: 'ok', api: 'unreachable' });

    await app.close();
  });
});
