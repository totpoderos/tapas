import { describe, expect, it, vi } from 'vitest';
import { dispatchToApi } from '../../src/api-dispatcher.js';

function fakeFetch(response: { ok: boolean; status: number; body: unknown }) {
  return vi.fn(async () => ({
    ok: response.ok,
    status: response.status,
    json: async () => response.body,
  })) as unknown as typeof fetch;
}

describe('dispatchToApi', () => {
  it('calls the API path with the host token as a bearer credential', async () => {
    const fetch = fakeFetch({ ok: true, status: 200, body: { id: 'c1' } });

    const result = await dispatchToApi(
      { apiBaseUrl: 'http://api.test', hostToken: 'pat-123', fetch },
      { method: 'GET', path: '/contests/c1' },
    );

    expect(fetch).toHaveBeenCalledWith(
      'http://api.test/contests/c1',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ authorization: 'Bearer pat-123' }),
      }),
    );
    expect(result).toEqual({ ok: true, status: 200, body: { id: 'c1' } });
  });

  it('returns a failed status rather than throwing, so the tool can relay it', async () => {
    const fetch = fakeFetch({ ok: false, status: 403, body: { error: { code: 'FORBIDDEN' } } });

    const result = await dispatchToApi(
      { apiBaseUrl: 'http://api.test', hostToken: 'pat-123', fetch },
      { method: 'GET', path: '/contests/other' },
    );

    expect(result).toEqual({ ok: false, status: 403, body: { error: { code: 'FORBIDDEN' } } });
  });

  it('sends a JSON body and content-type when a request carries one', async () => {
    const fetch = fakeFetch({ ok: true, status: 200, body: {} });

    await dispatchToApi(
      { apiBaseUrl: 'http://api.test', hostToken: 'pat-123', fetch },
      { method: 'POST', path: '/contests', body: { name: 'Summer' } },
    );

    expect(fetch).toHaveBeenCalledWith(
      'http://api.test/contests',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'content-type': 'application/json' }),
        body: JSON.stringify({ name: 'Summer' }),
      }),
    );
  });
});
