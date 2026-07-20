import { Writable } from 'node:stream';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerErrorHandling } from '../../src/http/error-handling.js';

/** Captures everything the Fastify/pino logger writes, so we can assert on it. */
function makeCapturingLogStream() {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  return { stream, output: () => chunks.join('') };
}

describe('production error handling', () => {
  it('logs the real error server-side before returning a generic body', async () => {
    const { stream, output } = makeCapturingLogStream();
    const app = Fastify({ logger: { level: 'error', stream } });
    registerErrorHandling(app, true);
    app.get('/boom', async () => {
      throw new Error('sensitive internal detail');
    });

    const response = await app.inject({ method: 'GET', url: '/boom' });

    // The client sees nothing revealing…
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('sensitive internal detail');
    // …but the error is captured in the server logs.
    expect(output()).toContain('sensitive internal detail');

    await app.close();
  });
});
