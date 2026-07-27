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

/**
 * `list_my_contests` — lists everything the host owns (drafts still being
 * prepared and published contests alike), each with its id, name, and state, so
 * the host has an overview by name and never needs an internal id. Read-only and
 * host-scoped; the API returns only the host's own.
 */
const listMyContests: McpTool = {
  name: 'list_my_contests',
  description:
    "List all of the host's own contests — both drafts still being prepared and published contests (live, closed, or revealed) — each with its id, name, and current state.",
  destructive: false,
  scope: 'host',
  inputSchema: {},
  toRequest: () => ({ method: 'GET', path: '/contests' }),
};

/**
 * `find_contest` — resolves one of the host's contests by name (exact, but
 * case-insensitive), so a host can refer to a contest the way they say it rather
 * than by id. A name is not unique — a host may run "Tapas Night" more than once —
 * so this returns every match; the assistant asks the host which one when more
 * than one comes back. A name that matches nothing returns an empty list.
 * Read-only and host-scoped; the API searches only the host's own contests. The
 * name is URL-encoded so a value can never break out of the query.
 */
const findContest: McpTool = {
  name: 'find_contest',
  description:
    "Find one of the host's own contests by name (case-insensitive). Returns every contest with that exact name — usually one, but more if the host has reused a name — each with its id, name, and current state; an empty list means no contest has that name.",
  destructive: false,
  scope: 'host',
  inputSchema: {
    name: z.string().min(1).describe('The exact name of the contest to find (case-insensitive).'),
  },
  toRequest: (args) => ({
    method: 'GET',
    path: `/contests?name=${encodeURIComponent(String(args.name))}`,
  }),
};

/**
 * `get_contest_details` — reads what is inside one of the host's contests, found
 * by name: who is taking part and how it is scored. Works for a draft or a
 * published contest. Like `find_contest`, a name is not unique, so when several
 * share a name the candidates come back for the host to choose from. Read-only
 * and host-scoped; the name is URL-encoded so a value can never break out.
 */
const getContestDetails: McpTool = {
  name: 'get_contest_details',
  description:
    "Read the details of one of the host's own contests by name — its status, who is taking part, and its scoring categories. Works for a draft or a published contest. When several contests share the name, returns the candidates to choose from instead.",
  destructive: false,
  scope: 'host',
  inputSchema: {
    name: z.string().min(1).describe('The exact name of the contest whose details to read (case-insensitive).'),
  },
  toRequest: (args) => ({
    method: 'GET',
    path: `/contests/details?name=${encodeURIComponent(String(args.name))}`,
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

// --- create_draft input shape ---------------------------------------------
// A draft's editable content (DraftContent): only `name` is required, the rest
// are filled in over time and fully validated by the API at publish. Defined
// here rather than imported from the domain so the adapter stays decoupled; the
// API remains the authoritative validator (two-phase, design.md §11B.3).
const scoringShape = z
  .object({
    categories: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) }).strict()).min(1),
    range: z.union([
      z.object({ type: z.literal('fixed'), min: z.number(), max: z.number() }).strict(),
      z.object({ type: z.literal('auto') }).strict(),
    ]),
    uniquePerCategory: z.boolean(),
  })
  .strict();

const personShape = z
  .object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    partnerId: z.string().min(1).optional(),
    noScoreWith: z.array(z.string().min(1)).optional(),
  })
  .strict();

const whenShape = z.union([
  z.object({ when: z.enum(['all_sent', 'host_trigger']) }).strict(),
  z.object({ when: z.literal('scheduled'), at: z.string().min(1) }).strict(),
]);

/** `create_draft` — saves a new contest draft. Only the name is required. Writes via POST /drafts. */
const createDraft: McpTool = {
  name: 'create_draft',
  description:
    'Save a new contest draft for the host. Only a name is required; rule-space fields can be added now or later, and are fully checked when the contest is published.',
  destructive: false,
  scope: 'host',
  inputSchema: {
    name: z.string().min(1).describe('The contest name.'),
    attribution: z.enum(['per_person', 'per_couple']).optional(),
    antiBias: z.enum(['none', 'couples', 'arbitrary_pairs']).optional(),
    scoring: scoringShape.optional(),
    participants: z.array(personShape).optional(),
    closeRule: whenShape.optional(),
    revealStrategy: whenShape.optional(),
  },
  toRequest: (args) => ({ method: 'POST', path: '/drafts', body: args }),
};

/** `update_draft` — renames an existing draft (the only draft edit the API exposes today). */
const updateDraft: McpTool = {
  name: 'update_draft',
  description: "Rename one of the host's contest drafts.",
  destructive: false,
  scope: 'host',
  inputSchema: {
    draftId: z.string().min(1).describe('The id of the draft to rename.'),
    name: z.string().min(1).describe('The new name for the draft.'),
  },
  toRequest: (args) => ({
    method: 'PATCH',
    path: `/drafts/${encodeURIComponent(String(args.draftId))}`,
    body: { name: args.name },
  }),
};

/**
 * `publish_contest` — publishes a draft into a live contest. Destructive: a
 * live contest cannot be un-published, so the server requires a confirmation.
 */
const publishContest: McpTool = {
  name: 'publish_contest',
  description:
    'Publish one of the host\'s drafts into a live contest, running the rule compiler. This cannot be undone.',
  destructive: true,
  scope: 'host',
  inputSchema: {
    draftId: z.string().min(1).describe('The id of the draft to publish.'),
    confirmationToken: z
      .string()
      .optional()
      .describe('The confirmation token the server issued for this exact action.'),
  },
  toRequest: (args) => ({
    method: 'POST',
    path: `/drafts/${encodeURIComponent(String(args.draftId))}/publish`,
  }),
};

/**
 * `trigger_reveal` — reveals a closed contest, announcing the winners.
 * Destructive (it cannot be undone), so the server requires a confirmation.
 */
const triggerReveal: McpTool = {
  name: 'trigger_reveal',
  description:
    "Reveal one of the host's closed contests, announcing the winners. The contest must already be closed. This cannot be undone.",
  destructive: true,
  scope: 'host',
  inputSchema: {
    contestId: z.string().min(1).describe('The id of the closed contest to reveal.'),
    confirmationToken: z
      .string()
      .optional()
      .describe('The confirmation token the server issued for this exact action.'),
  },
  toRequest: (args) => ({
    method: 'POST',
    path: `/contests/${encodeURIComponent(String(args.contestId))}/reveal`,
  }),
};

/** `get_results` — reads the final results of one of the host's revealed contests. */
const getResults: McpTool = {
  name: 'get_results',
  description:
    "Read the final results — category totals and winners — of one of the host's contests. The contest must already be revealed.",
  destructive: false,
  scope: 'host',
  inputSchema: {
    contestId: z.string().min(1).describe('The id of the revealed contest whose results to read.'),
  },
  toRequest: (args) => ({
    method: 'GET',
    path: `/contests/${encodeURIComponent(String(args.contestId))}/results`,
  }),
};

/** The tools the MCP server exposes. Grows one vertical slice at a time (design.md §6.1). */
export const TOOL_CATALOG: readonly McpTool[] = [
  getContest,
  listMyContests,
  findContest,
  getContestDetails,
  getDraft,
  getTally,
  closeContest,
  createDraft,
  updateDraft,
  publishContest,
  triggerReveal,
  getResults,
];
