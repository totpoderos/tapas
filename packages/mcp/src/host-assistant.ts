import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { LLMClient, LLMCompletion, LLMMessage, LLMToolDefinition } from '@tapas/shared';
import { buildMcpServer } from './mcp-server.js';

/**
 * The host's chat assistant (design.md §7): an LLM-mediated interface to the
 * same tools any MCP client could call. It works out which action the host
 * wants and proposes it as a tool call, or asks for clarification when the
 * request is ambiguous. It only *proposes* — executing the chosen tool, and
 * confirming anything destructive, happens through the tools themselves.
 */
const SYSTEM_PROMPT = `You are the assistant in a tapas-contest host's app. The host tells you, in
plain language, what they want to do with their contest, and you help by
calling the tools available to you — one or more per request.

Choose the tool that matches what the host asked and fill in its arguments from
what they told you. If the request is ambiguous, or you are missing something a
tool needs (for example which contest or draft they mean), do NOT guess: reply
in plain language asking the host for exactly what you need, and call no tool.

Some tools are destructive (closing, publishing, revealing). You may still
choose them, but they do not take effect until the host confirms — never treat
a destructive action as already done.`;

export interface HostAssistantDeps {
  readonly llmClient: LLMClient;
  /** The contest tools the assistant may choose from — see `hostAssistantTools`. */
  readonly tools: readonly LLMToolDefinition[];
}

export class HostAssistant {
  constructor(private readonly deps: HostAssistantDeps) {}

  /**
   * Given the conversation so far, returns the model's response: the tool
   * call(s) it proposes, or plain text when it needs the host to clarify.
   */
  async respond(history: readonly LLMMessage[]): Promise<LLMCompletion> {
    return this.deps.llmClient.complete({
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
      tools: this.deps.tools,
    });
  }
}

/**
 * The contest tools as LLM tool definitions, sourced from the MCP catalog
 * itself (via the server's tool listing) so the model sees exactly the tools —
 * names, descriptions, JSON-schema arguments — that the MCP surface exposes.
 * One source of truth, no second schema to keep in step.
 */
export async function hostAssistantTools(): Promise<LLMToolDefinition[]> {
  const server = buildMcpServer({
    apiBaseUrl: 'http://tool-listing.invalid',
    hostToken: 'unused-for-listing',
    confirmationSecret: 'unused-for-listing',
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'tool-lister', version: '0.0.0' });
  await client.connect(clientTransport);

  const { tools } = await client.listTools();

  await client.close();
  await server.close();

  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? '',
    inputSchema: tool.inputSchema as Record<string, unknown>,
  }));
}
