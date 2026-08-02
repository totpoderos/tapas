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

describe('runAssistantMessage over several proposed calls', () => {
  /** Answers the name-settling read with one contest; records what was actually run. */
  function executeStub() {
    const ran: string[] = [];
    const execute = vi.fn(async (request: { method: string; path: string }) => {
      if (request.method === 'GET' && request.path.startsWith('/contests?name=')) {
        return {
          ok: true,
          body: [{ id: 'c1', name: 'Tapas', status: 'draft', updatedAt: '2026-01-01T00:00:00.000Z' }],
        };
      }
      ran.push(`${request.method} ${request.path}`);
      return { ok: true, body: {} };
    });
    return { execute, ran };
  }

  const chain = (...calls: { name: string; arguments: Record<string, unknown> }[]) =>
    assistantReturning({ text: '', toolCalls: calls });

  it('carries out every proposed call, in the order it was proposed', async () => {
    const { execute, ran } = executeStub();
    const turn = await runAssistantMessage(
      [{ role: 'user', content: 'do all of it' }],
      turnDeps({
        execute,
        assistant: chain(
          { name: 'create_draft', arguments: { name: 'Tapas' } },
          { name: 'add_category', arguments: { contest: 'Tapas', category: 'Taste' } },
          { name: 'add_participant', arguments: { contest: 'Tapas', participant: 'Carlos' } },
        ),
      }),
    );

    expect(turn.kind).toBe('steps');
    if (turn.kind !== 'steps') return;
    expect(turn.steps.map((step) => step.action)).toEqual([
      'create_draft',
      'add_category',
      'add_participant',
    ]);
    expect(turn.notReached).toEqual([]);
    expect(ran).toHaveLength(3);
  });

  /*
   * The one with teeth. A confirmation approves the action it names; whatever a
   * message queued behind it was never part of what the host agreed to, so it
   * must not have run — and the host must be told it did not.
   */
  it('stops at the first destructive call and never runs what was queued behind it', async () => {
    const { execute, ran } = executeStub();
    const turn = await runAssistantMessage(
      [{ role: 'user', content: 'add one, publish, then rename' }],
      turnDeps({
        execute,
        assistant: chain(
          { name: 'add_category', arguments: { contest: 'Tapas', category: 'Taste' } },
          { name: 'publish_contest', arguments: { contest: 'Tapas' } },
          { name: 'rename_contest', arguments: { contest: 'Tapas', name: 'Later' } },
        ),
      }),
    );

    expect(turn.kind).toBe('steps');
    if (turn.kind !== 'steps') return;
    expect(turn.steps.map((step) => step.kind)).toEqual(['result', 'confirm']);
    expect(turn.notReached).toEqual(['rename_contest']);
    expect(ran.some((request) => request.includes('rename') || request.includes('publish'))).toBe(false);
  });

  it('stops at the first failure, keeping what already happened', async () => {
    const ran: string[] = [];
    const execute = vi.fn(async (request: { method: string; path: string }) => {
      if (request.method === 'GET' && request.path.startsWith('/contests?name=')) {
        return { ok: true, body: [{ id: 'c1', name: 'Tapas', status: 'draft', updatedAt: 'x' }] };
      }
      ran.push(request.path);
      // The second thing asked for is refused; the third must never be tried.
      if (ran.length === 2) {
        return { ok: false, body: { error: { code: 'ALREADY_JUDGED_ON', message: 'Already judged on that.' } } };
      }
      return { ok: true, body: {} };
    });

    const turn = await runAssistantMessage(
      [{ role: 'user', content: 'three things' }],
      turnDeps({
        execute,
        assistant: chain(
          { name: 'add_participant', arguments: { contest: 'Tapas', participant: 'Carlos' } },
          { name: 'add_category', arguments: { contest: 'Tapas', category: 'Taste' } },
          { name: 'add_category', arguments: { contest: 'Tapas', category: 'Presentation' } },
        ),
      }),
    );

    expect(turn.kind).toBe('steps');
    if (turn.kind !== 'steps') return;
    expect(turn.steps.map((step) => step.kind)).toEqual(['result', 'failed']);
    expect(turn.steps[1]).toMatchObject({ message: 'Already judged on that.' });
    expect(turn.notReached).toEqual(['add_category']);
    expect(ran).toHaveLength(2);
  });

  it('reports a call it cannot understand as that step failing, and stops', async () => {
    const { execute, ran } = executeStub();
    const turn = await runAssistantMessage(
      [{ role: 'user', content: 'do it' }],
      turnDeps({
        execute,
        assistant: chain(
          { name: 'add_category', arguments: { contest: 'Tapas', category: 'Taste' } },
          { name: 'no_such_tool', arguments: {} },
          { name: 'add_participant', arguments: { contest: 'Tapas', participant: 'Carlos' } },
        ),
      }),
    );

    expect(turn.kind).toBe('steps');
    if (turn.kind !== 'steps') return;
    expect(turn.steps.map((step) => step.kind)).toEqual(['result', 'failed']);
    expect(turn.notReached).toEqual(['add_participant']);
    expect(ran).toHaveLength(1);
  });

  it('answers a message asking for one thing in that step\'s own shape', async () => {
    const { execute } = executeStub();
    const turn = await runAssistantMessage(
      [{ role: 'user', content: 'just one' }],
      turnDeps({ execute, assistant: chain({ name: 'create_draft', arguments: { name: 'Tapas' } }) }),
    );

    // Not wrapped in a list of one: the common case is left exactly as it was.
    expect(turn.kind).toBe('result');
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
