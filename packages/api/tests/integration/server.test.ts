import { describe, expect, it } from 'vitest';
import { makeTestApp } from '../support/test-server.js';

describe('api server', async () => {
  it('responds to the health check', async () => {
    const { app } = await makeTestApp();
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });

    await app.close();
  });
});
