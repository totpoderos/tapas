import type { FastifyInstance } from 'fastify';
import type { LLMMessage } from '@tapas/shared';
import { HostAssistant, hostAssistantTools, type ApiRequest } from '@tapas/mcp';
import {
  runAssistantMessage,
  runConfirmedAction,
  UnknownActionError,
  type ConfirmRequest,
  type TurnDeps,
} from '../assistant/host-assistant-turn.js';
import { requireHostSession } from './require-host-session.js';
import type { ServerDeps } from './server-deps.js';

const notSignedIn = { error: { code: 'NOT_SIGNED_IN', message: 'Sign in required.' } };
const badRequest = (message: string) => ({ error: { code: 'BAD_REQUEST', message } });

interface AssistantBody {
  readonly messages?: readonly LLMMessage[];
  readonly confirm?: ConfirmRequest;
}

/**
 * The in-app host assistant (design.md §7) — the third entry point to the API,
 * alongside HTTP and MCP. A signed-in host chats in plain language; the assistant
 * clarifies, runs a reversible action, or asks the host to confirm anything
 * destructive. Tools run by dispatching their intended request back through this
 * same API as the signed-in host (forwarding their session cookie), so ownership
 * and every rule are enforced exactly once, by the routes that already exist.
 */
export function registerAssistantRoutes(app: FastifyInstance, deps: ServerDeps): void {
  const requireSession = requireHostSession(deps);

  // The tool definitions (from the MCP catalog) are loaded once, lazily, on the
  // first request — building them stands up an in-memory MCP server briefly.
  let assistantPromise: Promise<HostAssistant> | undefined;
  const getAssistant = () =>
    (assistantPromise ??= hostAssistantTools().then(
      (tools) => new HostAssistant({ llmClient: deps.llmClient, tools }),
    ));

  app.post<{ Body: AssistantBody }>(
    '/assistant/messages',
    { preHandler: requireSession },
    async (request, reply) => {
      if (!request.hostSession) return reply.code(401).send(notSignedIn);

      // Every tool the assistant runs is dispatched back through this API as the
      // same host, by forwarding their session cookie — one execution path.
      const execute = async (apiRequest: ApiRequest): Promise<unknown> => {
        const response = await app.inject({
          method: apiRequest.method,
          url: apiRequest.path,
          payload: apiRequest.body as object | undefined,
          headers: { cookie: request.headers.cookie ?? '' },
        });
        return response.statusCode === 204 || response.body === '' ? undefined : response.json();
      };

      const turnDeps: TurnDeps = {
        assistant: await getAssistant(),
        confirmationSecret: deps.assistantConfirmationSecret,
        execute,
      };

      try {
        if (request.body?.confirm) {
          return reply.code(200).send(await runConfirmedAction(request.body.confirm, turnDeps));
        }
        const messages = request.body?.messages;
        if (!messages || messages.length === 0) {
          return reply.code(400).send(badRequest('A message or a confirmation is required.'));
        }
        return reply.code(200).send(await runAssistantMessage(messages, turnDeps));
      } catch (error) {
        if (error instanceof UnknownActionError) {
          return reply.code(400).send(badRequest('That action cannot be confirmed.'));
        }
        throw error;
      }
    },
  );
}
