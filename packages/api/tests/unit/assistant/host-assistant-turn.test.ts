import { describe, expect, it, vi } from 'vitest';
import type { HostAssistant } from '@tapas/mcp';
import { confirmationTokenFor } from '@tapas/mcp';
import type { LLMCompletion } from '@tapas/shared';
import {
  runAssistantMessage,
  runConfirmedAction,
  UnknownActionError,
  type TurnDeps,
} from '../../../src/index.js';

const SECRET = 'unit-test-assistant-secret-of-32+chars';

/** A HostAssistant stand-in that returns a fixed completion. */
function assistantReturning(completion: LLMCompletion): HostAssistant {
  return { respond: vi.fn(async () => completion) } as unknown as HostAssistant;
}

function turnDeps(overrides: Partial<TurnDeps> & Pick<TurnDeps, 'assistant'>): TurnDeps {
  return { confirmationSecret: SECRET, execute: vi.fn(async () => ({ ok: true, body: {} })), ...overrides };
}

describe('runAssistantMessage', () => {
  it('replies without executing anything when the assistant proposes no tool', async () => {
    const execute = vi.fn();
    const turn = await runAssistantMessage(
      [{ role: 'user', content: 'hi' }],
      turnDeps({ assistant: assistantReturning({ text: 'What contest?', toolCalls: [] }), execute }),
    );
    expect(turn).toEqual({ kind: 'reply', text: 'What contest?' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('executes a reversible tool and returns its result', async () => {
    const execute = vi.fn(async () => ({ ok: true, body: { id: 'd1' } }));
    const turn = await runAssistantMessage(
      [{ role: 'user', content: 'make a draft' }],
      turnDeps({
        assistant: assistantReturning({ text: 'done', toolCalls: [{ name: 'create_draft', arguments: { name: 'X' } }] }),
        execute,
      }),
    );
    // The executor is also told which tool ran, and with what, so the caller can
    // record how the action arrived without this module knowing about audit logs.
    expect(execute).toHaveBeenCalledWith(
      { method: 'POST', path: '/drafts', body: { name: 'X' } },
      { toolName: 'create_draft', toolArgs: { name: 'X' } },
    );
    expect(turn).toEqual({ kind: 'result', action: 'create_draft', text: 'done', result: { id: 'd1' } });
  });

  it('does not execute a destructive tool — it asks to confirm with an action-bound token', async () => {
    // The one call it does make is the read that settles which contest is meant;
    // the action itself is not attempted.
    const execute = vi.fn(async () => ({
      ok: true,
      body: [{ id: 'c1', name: 'Tapas Night', status: 'live', updatedAt: '2026-01-01T00:00:00.000Z' }],
    }));
    const turn = await runAssistantMessage(
      [{ role: 'user', content: 'close it' }],
      turnDeps({
        assistant: assistantReturning({ text: '', toolCalls: [{ name: 'close_contest', arguments: { contest: 'Tapas Night' } }] }),
        execute,
      }),
    );
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(
      { method: 'GET', path: '/contests?name=Tapas%20Night' },
      expect.anything(),
    );
    expect(turn).toMatchObject({ kind: 'confirm', action: 'close_contest', args: { contest: 'Tapas Night' } });
    expect((turn as { confirmationToken: string }).confirmationToken).toBe(
      confirmationTokenFor(SECRET, 'close_contest', { contest: 'Tapas Night' }),
    );
  });
});

describe('runConfirmedAction', () => {
  it('executes when the token matches the action', async () => {
    const execute = vi.fn(async () => ({ ok: true, body: { status: 'closed' } }));
    const token = confirmationTokenFor(SECRET, 'close_contest', { contest: 'Tapas Night' });
    const turn = await runConfirmedAction(
      { action: 'close_contest', args: { contest: 'Tapas Night' }, confirmationToken: token },
      turnDeps({ assistant: assistantReturning({ text: '', toolCalls: [] }), execute }),
    );
    expect(execute).toHaveBeenCalledWith(
      { method: 'POST', path: '/contests/by-name/close', body: { contest: 'Tapas Night' } },
      { toolName: 'close_contest', toolArgs: { contest: 'Tapas Night' } },
    );
    expect(turn).toMatchObject({ kind: 'result', action: 'close_contest' });
  });

  it('re-asks (does not execute) when a token issued for another action is reused', async () => {
    const execute = vi.fn();
    const tokenForFirst = confirmationTokenFor(SECRET, 'close_contest', { contest: 'Tapas Night' });
    const turn = await runConfirmedAction(
      { action: 'close_contest', args: { contest: 'Sunday Roast' }, confirmationToken: tokenForFirst },
      turnDeps({ assistant: assistantReturning({ text: '', toolCalls: [] }), execute }),
    );
    expect(execute).not.toHaveBeenCalled();
    expect(turn).toMatchObject({ kind: 'confirm', action: 'close_contest', args: { contest: 'Sunday Roast' } });
  });

  it('rejects a confirmation for something that is not a known destructive tool', async () => {
    await expect(
      runConfirmedAction(
        { action: 'get_contest', args: { contest: 'Tapas Night' }, confirmationToken: 'x' },
        turnDeps({ assistant: assistantReturning({ text: '', toolCalls: [] }) }),
      ),
    ).rejects.toBeInstanceOf(UnknownActionError);
  });
});
