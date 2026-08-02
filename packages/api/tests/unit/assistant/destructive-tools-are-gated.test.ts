import { describe, expect, it, vi } from 'vitest';
import type { HostAssistant } from '@tapas/mcp';
import { TOOL_CATALOG, confirmationTokenFor } from '@tapas/mcp';
import type { LLMCompletion } from '@tapas/shared';
import { runAssistantMessage, runConfirmedAction, type TurnDeps } from '../../../src/index.js';

const SECRET = 'unit-test-assistant-secret-of-32+chars';

function assistantReturning(completion: LLMCompletion): HostAssistant {
  return { respond: vi.fn(async () => completion) } as unknown as HostAssistant;
}

/** Plausible arguments for a tool, from its own schema keys — enough to reach the gate. */
function argsFor(tool: (typeof TOOL_CATALOG)[number]): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const key of Object.keys(tool.inputSchema)) {
    if (key === 'confirmationToken') continue;
    args[key] = key === 'content' ? { name: 'X' } : 'x';
  }
  return args;
}

const destructive = TOOL_CATALOG.filter((tool) => tool.destructive);

/**
 * The in-app assistant and the MCP server are two ways to the same tools. A guard
 * that holds on one and not the other is the exact failure shape recorded in
 * docs/threat-model.md §4 — it has produced three defects in this project, each
 * of which shipped with a green suite.
 *
 * So this asserts the property for EVERY destructive tool rather than for the one
 * being added today: whatever lands in the catalog next inherits the check, and a
 * destructive tool that somehow bypassed confirmation would fail here.
 */
describe('every destructive tool is confirmation-gated on the assistant path', () => {
  it('has destructive tools to check', () => {
    expect(destructive.length).toBeGreaterThan(0);
    expect(destructive.map((tool) => tool.name)).toContain('delete_contest');
  });

  /**
   * Answers the "which contest do they mean?" read with exactly one contest, and
   * records anything else as an attempt to actually do something.
   *
   * A destructive action now settles its contest name before the host is asked
   * to approve it, so a first proposal DOES reach the API — for a read. The
   * property under test is unchanged and is asserted more precisely for it:
   * nothing was carried out.
   */
  function executeStub() {
    const attempted: string[] = [];
    const execute = vi.fn(async (request: { method: string; path: string }) => {
      if (request.method === 'GET' && request.path.startsWith('/contests?name=')) {
        return { ok: true, body: [{ id: 'c1', name: 'x', status: 'live', updatedAt: '2026-01-01T00:00:00.000Z' }] };
      }
      attempted.push(`${request.method} ${request.path}`);
      return { ok: true, body: {} };
    });
    return { execute, attempted };
  }

  it.each(destructive.map((tool) => [tool.name, tool] as const))(
    '%s is never carried out on a first proposal',
    async (_name, tool) => {
      const { execute, attempted } = executeStub();
      const turn = await runAssistantMessage(
        [{ role: 'user', content: 'do it' }],
        {
          assistant: assistantReturning({
            text: '',
            toolCalls: [{ name: tool.name, arguments: argsFor(tool) }],
          }),
          confirmationSecret: SECRET,
          execute,
        } satisfies TurnDeps,
      );

      expect(turn.kind).toBe('confirm');
      expect(attempted).toEqual([]);
    },
  );

  /* The other half of settling first: the host is never asked to approve a name
     that is not yet one contest. */
  it.each(destructive.map((tool) => [tool.name, tool] as const))(
    '%s asks which contest is meant rather than for a confirmation, when the name is shared',
    async (_name, tool) => {
      const attempted: string[] = [];
      const twoOfThem = [
        { id: 'c1', name: 'Tapas Night', status: 'live', updatedAt: '2026-01-01T00:00:00.000Z' },
        { id: 'c2', name: 'Tapas Night', status: 'live', updatedAt: '2026-01-01T00:00:00.000Z' },
      ];
      const execute = vi.fn(async (request: { method: string; path: string }) => {
        if (request.method === 'GET' && request.path.startsWith('/contests?name=')) {
          return { ok: true, body: twoOfThem };
        }
        attempted.push(`${request.method} ${request.path}`);
        return { ok: true, body: {} };
      });

      const turn = await runAssistantMessage(
        [{ role: 'user', content: 'do it' }],
        {
          assistant: assistantReturning({
            text: '',
            toolCalls: [{ name: tool.name, arguments: argsFor(tool) }],
          }),
          confirmationSecret: SECRET,
          execute,
        } satisfies TurnDeps,
      );

      // Tools that name no contest (none today, but the catalogue grows) have
      // nothing to settle and are challenged as before.
      if (!('contest' in tool.inputSchema)) {
        expect(turn.kind).toBe('confirm');
        return;
      }
      expect(turn.kind).toBe('result');
      expect(turn).toMatchObject({ result: { candidates: twoOfThem } });
      expect(attempted).toEqual([]);
    },
  );

  it.each(destructive.map((tool) => [tool.name, tool] as const))(
    '%s is refused when confirmed with a token for a different action',
    async (_name, tool) => {
      const execute = vi.fn(async () => ({ ok: true, body: {} }));
      const args = argsFor(tool);
      // A token minted for the same tool but different arguments.
      const wrong = confirmationTokenFor(SECRET, tool.name, { ...args, contestId: 'somewhere-else' });

      const turn = await runConfirmedAction(
        { action: tool.name, args, confirmationToken: wrong },
        { assistant: assistantReturning({ text: '', toolCalls: [] }), confirmationSecret: SECRET, execute },
      );

      // It asks again rather than throwing — but the essential part is that the
      // action did NOT run on a token that was not issued for it.
      expect(turn.kind).toBe('confirm');
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it.each(destructive.map((tool) => [tool.name, tool] as const))(
    '%s runs once confirmed with its own token',
    async (_name, tool) => {
      const execute = vi.fn(async () => ({ ok: true, body: {} }));
      const args = argsFor(tool);
      const token = confirmationTokenFor(SECRET, tool.name, args);

      const turn = await runConfirmedAction(
        { action: tool.name, args, confirmationToken: token },
        { assistant: assistantReturning({ text: '', toolCalls: [] }), confirmationSecret: SECRET, execute },
      );

      expect(turn.kind).not.toBe('confirm');
      expect(execute).toHaveBeenCalledTimes(1);
    },
  );
});
