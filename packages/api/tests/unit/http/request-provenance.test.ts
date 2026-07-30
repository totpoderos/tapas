import type { FastifyRequest } from 'fastify';
import { describe, expect, it } from 'vitest';
import { dispatchedAs, provenanceOfRequest } from '../../../src/http/request-provenance.js';

/** Just enough of a request to be asked what headers it carries. */
const carrying = (headers: Record<string, string> = {}) => ({ headers }) as FastifyRequest;

describe('how a request says it arrived', () => {
  it('is the app, for a request nobody marked', () => {
    expect(provenanceOfRequest(carrying())).toEqual({ sourcePath: 'form' });
  });

  it('is the connected tool, for one dispatched by the assistant', async () => {
    await dispatchedAs(
      { sourcePath: 'mcp', toolName: 'update_draft', toolArgs: { name: 'Otoño' } },
      async (headers) => {
        expect(provenanceOfRequest(carrying(headers))).toEqual({
          sourcePath: 'mcp',
          toolName: 'update_draft',
          toolArgs: { name: 'Otoño' },
        });
      },
    );
  });

  it('carries the arguments without putting them in a header', async () => {
    /*
     * The whole reason for the ticket: a tool's arguments are model-produced
     * JSON, and they stay in this process. What crosses the boundary is an
     * opaque id and nothing else.
     */
    await dispatchedAs(
      { sourcePath: 'mcp', toolName: 'update_draft', toolArgs: { name: 'Otoño' } },
      async (headers) => {
        const written = JSON.stringify(headers);
        expect(written).not.toContain('Otoño');
        expect(written).not.toContain('update_draft');
      },
    );
  });

  it('stops meaning anything once the dispatch is over', async () => {
    // A ticket must not outlive its dispatch and colour a later request.
    let issued: Record<string, string> = {};
    await dispatchedAs({ sourcePath: 'mcp', toolName: 'update_draft' }, async (headers) => {
      issued = headers;
      expect(provenanceOfRequest(carrying(headers)).sourcePath).toBe('mcp');
    });

    expect(provenanceOfRequest(carrying(issued))).toEqual({ sourcePath: 'form' });
  });

  it('is dropped even when the dispatch fails', async () => {
    let issued: Record<string, string> = {};
    await expect(
      dispatchedAs({ sourcePath: 'mcp', toolName: 'close_contest' }, async (headers) => {
        issued = headers;
        throw new Error('the request blew up');
      }),
    ).rejects.toThrow('the request blew up');

    expect(provenanceOfRequest(carrying(issued))).toEqual({ sourcePath: 'form' });
  });

  it('does not confuse two dispatches running at the same time', async () => {
    const seen = async (toolName: string, delay: number) =>
      dispatchedAs({ sourcePath: 'mcp', toolName }, async (headers) => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return provenanceOfRequest(carrying(headers)).toolName;
      });

    expect(await Promise.all([seen('first_tool', 5), seen('second_tool', 0)])).toEqual([
      'first_tool',
      'second_tool',
    ]);
  });

  it('treats a made-up ticket as no ticket at all', () => {
    /*
     * The header on its own grants nothing: it only names an entry this process
     * is holding, and the worst a guessed one could do is mislabel the caller's
     * own action in the caller's own log.
     */
    expect(provenanceOfRequest(carrying({ 'x-tapas-dispatch': 'not-a-real-ticket' }))).toEqual({
      sourcePath: 'form',
    });
  });
});
