import { describe, expect, it } from 'vitest';
import { makeTestApp } from '../support/test-server.js';

describe('api server', () => {
  it('responds to the health check', async () => {
    const { app } = makeTestApp();
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });

    await app.close();
  });
});
