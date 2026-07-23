import { z, type ZodRawShape } from 'zod';
import type { ApiRequest } from './api-dispatcher.js';

/**
 * A tool the MCP server exposes (design.md §6). It carries the LLM-facing
 * definition (name, description, input shape) plus the protocol-level metadata
 * the adapter enforces — `destructive` triggers the confirmation flow, `scope`
 * is the authorization the API will require — and `toRequest`, the pure mapping
 * from validated arguments to the API request the adapter should make. The
 * mapping lives on each tool, so the dispatcher stays a single generic path
 * rather than a switch that grows with the catalog.
 *
 * `inputSchema` is a Zod raw shape: the SDK validates arguments against it and
 * derives the JSON schema advertised to the model, so there is no second,
 * hand-kept schema to drift.
 */
export interface McpTool {
  readonly name: string;
  readonly description: string;
  readonly destructive: boolean;
  readonly scope: 'host' | 'voter' | 'public';
  readonly inputSchema: ZodRawShape;
  toRequest(args: Record<string, unknown>): ApiRequest;
}

/**
 * `get_contest` — reads one of the host's own contests. Read-only and
 * host-scoped; the API enforces ownership, the adapter only forwards. The id
 * is URL-encoded so a value can never break out of the path.
 */
const getContest: McpTool = {
  name: 'get_contest',
  description: "Read one of the host's own contests by id and return its current state.",
  destructive: false,
  scope: 'host',
  inputSchema: { contestId: z.string().min(1).describe('The id of the contest to read.') },
  toRequest: (args) => ({
    method: 'GET',
    path: `/contests/${encodeURIComponent(String(args.contestId))}`,
  }),
};

/** `get_draft` — reads one of the host's own contest drafts (still being prepared). */
const getDraft: McpTool = {
  name: 'get_draft',
  description: "Read one of the host's own contest drafts by id and return its current content.",
  destructive: false,
  scope: 'host',
  inputSchema: { draftId: z.string().min(1).describe('The id of the draft to read.') },
  toRequest: (args) => ({
    method: 'GET',
    path: `/drafts/${encodeURIComponent(String(args.draftId))}`,
  }),
};

/** `get_tally` — reads the live tally of the host's contest: how many have claimed, are scoring, have sent. */
const getTally: McpTool = {
  name: 'get_tally',
  description:
    "Read the live tally of one of the host's contests: how many participants have claimed a place, are still scoring, and have sent their votes.",
  destructive: false,
  scope: 'host',
  inputSchema: { contestId: z.string().min(1).describe('The id of the contest whose tally to read.') },
  toRequest: (args) => ({
    method: 'GET',
    path: `/contests/${encodeURIComponent(String(args.contestId))}/tally`,
  }),
};

/**
 * `close_contest` — forces one of the host's contests to close. Destructive
 * (irreversible), so the server requires a confirmation before it runs; the
 * optional `confirmationToken` is a protocol concern and is NOT forwarded to
 * the API (`toRequest` ignores it).
 */
const closeContest: McpTool = {
  name: 'close_contest',
  description:
    "Close one of the host's own contests now, so no more votes can be sent. This cannot be undone.",
  destructive: true,
  scope: 'host',
  inputSchema: {
    contestId: z.string().min(1).describe('The id of the contest to close.'),
    confirmationToken: z
      .string()
      .optional()
      .describe('The confirmation token the server issued for this exact action.'),
  },
  toRequest: (args) => ({
    method: 'POST',
    path: `/contests/${encodeURIComponent(String(args.contestId))}/close`,
  }),
};

/** The tools the MCP server exposes. Grows one vertical slice at a time (design.md §6.1). */
export const TOOL_CATALOG: readonly McpTool[] = [getContest, getDraft, getTally, closeContest];
