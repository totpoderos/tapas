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
 * How every host-facing tool names the contest it acts on. Written once so the
 * model is told the rule once: a host says a name, never an internal id, and a
 * name that several contests share is settled with the host before anything
 * happens rather than guessed at.
 */
const CONTEST_NAME = z
  .string()
  .min(1)
  .describe(
    "The exact name of the contest, as the host says it (case-insensitive). Never an id — the host does not see ids. If the answer comes back with `candidates`, the host has more than one contest with that name and nothing was changed: ask them which one they mean before trying again. An empty `candidates` list means no contest has that name.",
  );

/** The protocol-level confirmation a destructive tool carries. Never forwarded to the API. */
const CONFIRMATION_TOKEN = z
  .string()
  .optional()
  .describe('The confirmation token the server issued for this exact action.');

/**
 * `get_contest` — reads one of the host's own contests, by the name the host
 * says. Read-only and host-scoped; the API enforces ownership and resolves the
 * name, the adapter only forwards. The name is URL-encoded so a value can never
 * break out of the query.
 */
const getContest: McpTool = {
  name: 'get_contest',
  description:
    "Read one of the host's own contests by its name and return its current state. When several of the host's contests share the name, returns the candidates to choose from instead; when none has it, returns no candidates.",
  destructive: false,
  scope: 'host',
  inputSchema: { contest: CONTEST_NAME },
  toRequest: (args) => ({
    method: 'GET',
    path: `/contests/by-name?name=${encodeURIComponent(String(args.contest))}`,
  }),
};

/**
 * `list_my_contests` — lists everything the host owns (drafts still being
 * prepared and published contests alike), each with its id, name, and state, so
 * the host has an overview by name and never needs an internal id. Read-only and
 * host-scoped; the API returns only the host's own.
 *
 * Each entry also carries how the contest is going, so an assistant can answer
 * "how is the spring contest doing?" from the list instead of reading each
 * contest in turn. What a contest cannot have yet is absent rather than zero: a
 * draft has no join code and no progress, and saying it had none sent would read
 * as nobody having voted. The description says so, because an assistant that
 * mistakes one for the other tells the host something untrue.
 */
const listMyContests: McpTool = {
  name: 'list_my_contests',
  description:
    "List all of the host's own contests — both drafts still being prepared and published contests (live, closed, or revealed) — each with its id, name, and current state. Each also carries what it is judged on (its format and how many scoring categories), its join code, and its progress (how many people have claimed a place, how many are still scoring, and how many have sent their vote). A contest still being prepared has no join code and no progress at all — that means voting has not started, which is NOT the same as nobody having voted yet.",
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

/**
 * `add_participant` — adds someone to one of the host's drafts, found by name.
 * For drafts only (a published contest's participants are settled). Reversible,
 * so not destructive. When several drafts share the name, the candidates come
 * back for the host to choose from.
 */
const addParticipant: McpTool = {
  name: 'add_participant',
  description:
    "Add a participant, by their display name, to one of the host's contest DRAFTS (found by the contest's name). Returns the draft's updated participant list, or — when several drafts share the name — the candidates to choose from.",
  destructive: false,
  scope: 'host',
  inputSchema: {
    contest: CONTEST_NAME,
    participant: z.string().min(1).describe('The display name of the participant to add.'),
  },
  toRequest: (args) => ({
    method: 'POST',
    path: '/drafts/participants',
    body: { contest: args.contest, participant: args.participant },
  }),
};

/**
 * `remove_participant` — removes someone from one of the host's drafts, found by
 * name. Destructive (removing a person), so the assistant confirms with the host
 * before it runs (design.md §6.1). The params ride the query so no body is needed.
 */
const removeParticipant: McpTool = {
  name: 'remove_participant',
  description:
    "Remove a participant, by their display name, from one of the host's contest DRAFTS (found by the contest's name). Returns the draft's updated participant list.",
  destructive: true,
  scope: 'host',
  inputSchema: {
    contest: CONTEST_NAME,
    participant: z.string().min(1).describe('The display name of the participant to remove.'),
    confirmationToken: CONFIRMATION_TOKEN,
  },
  toRequest: (args) => ({
    method: 'DELETE',
    path: `/drafts/participants?contest=${encodeURIComponent(String(args.contest))}&participant=${encodeURIComponent(String(args.participant))}`,
  }),
};

/**
 * `add_category` — adds something for one of the host's drafts to be judged on.
 * Drafts only: a published contest's scoring is settled. Reversible, so not
 * destructive. A name the draft already carries is refused rather than added
 * twice — the assistant addresses a category by its name, so two of the same
 * name would leave the host unable to say which one they meant.
 */
const addCategory: McpTool = {
  name: 'add_category',
  description:
    "Add something for one of the host's contest DRAFTS to be judged on — a scoring category such as \"Taste\" or \"Presentation\" — found by the contest's name. Adds one at a time. Refused if the contest is already judged on something with that name. Returns the draft's updated details.",
  destructive: false,
  scope: 'host',
  inputSchema: {
    contest: CONTEST_NAME,
    category: z.string().min(1).describe('What the dishes are judged on, e.g. "Taste".'),
  },
  toRequest: (args) => ({
    method: 'POST',
    path: '/drafts/by-name/categories',
    body: { contest: args.contest, category: args.category },
  }),
};

/**
 * `remove_category` — stops one of the host's drafts being judged on something.
 * Destructive: it takes away a category the host named, so the server requires a
 * confirmation first, exactly as removing a participant does.
 */
const removeCategory: McpTool = {
  name: 'remove_category',
  description:
    "Stop one of the host's contest DRAFTS being judged on something, found by the contest's name and the category's name. Refused if the contest is not judged on it. This takes away something the host set up, so it must be confirmed.",
  destructive: true,
  scope: 'host',
  inputSchema: {
    contest: CONTEST_NAME,
    category: z.string().min(1).describe('What to stop judging on, e.g. "Presentation".'),
    confirmationToken: CONFIRMATION_TOKEN,
  },
  toRequest: (args) => ({
    method: 'DELETE',
    path: `/drafts/by-name/categories?contest=${encodeURIComponent(String(args.contest))}&category=${encodeURIComponent(String(args.category))}`,
  }),
};

/**
 * `set_score_range` — sets the range scores are given within on one of the
 * host's drafts. Omitting both bounds means the range is worked out from the
 * contest itself (1..however many dishes each judge may score), which is how a
 * ranking is asked for.
 */
const setScoreRange: McpTool = {
  name: 'set_score_range',
  description:
    "Set the range scores are given within on one of the host's contest DRAFTS, found by the contest's name. Give both `min` and `max` for a fixed range (e.g. 1 to 10). Give NEITHER to let the contest work its own range out — each judge then scores from 1 up to however many dishes they may score, which is a ranking. One bound alone is not a range and is treated as neither.",
  destructive: false,
  scope: 'host',
  inputSchema: {
    contest: CONTEST_NAME,
    min: z.number().optional().describe('The lowest score. Omit (with max) to work the range out from the contest.'),
    max: z.number().optional().describe('The highest score. Omit (with min) to work the range out from the contest.'),
  },
  toRequest: (args) => ({
    method: 'PUT',
    path: '/drafts/by-name/score-range',
    body: { contest: args.contest, min: args.min, max: args.max },
  }),
};

/**
 * `set_score_uniqueness` — settles whether a judge may give the same score to
 * more than one dish within a category, on one of the host's drafts.
 */
const setScoreUniqueness: McpTool = {
  name: 'set_score_uniqueness',
  description:
    "Settle whether a judge may give the same score to more than one dish within a category, on one of the host's contest DRAFTS, found by the contest's name. `true` means every dish in a category must get a different score (a ranking); `false` means a score may be repeated.",
  destructive: false,
  scope: 'host',
  inputSchema: {
    contest: CONTEST_NAME,
    uniquePerCategory: z
      .boolean()
      .describe('true = each score may be used only once per category; false = scores may repeat.'),
  },
  toRequest: (args) => ({
    method: 'PUT',
    path: '/drafts/by-name/score-uniqueness',
    body: { contest: args.contest, uniquePerCategory: args.uniquePerCategory },
  }),
};

/**
 * `set_format` — says what kind of contest one of the host's drafts is. The
 * format is the whole of what a contest says about who cooks and who may not
 * score whom, so there is no second rule to set beside it.
 *
 * A format the draft's people cannot yet satisfy — couples, while somebody is
 * still unpaired — is settled rather than refused: that is an ordinary halfway
 * state, and publishing is what checks it.
 */
const setFormat: McpTool = {
  name: 'set_format',
  description:
    'Say what kind of contest one of the host\'s DRAFTS is, found by its name. "solo" — each person cooks their own dish and scores every other; "solo_with_partners" — each person cooks their own dish and whoever has a partner does not score their partner\'s; "couples" — each couple cooks one dish, everybody has a partner, and nobody scores their own couple\'s dish. Setting "couples" before everybody is paired is allowed; publishing is what checks it.',
  destructive: false,
  scope: 'host',
  inputSchema: {
    contest: CONTEST_NAME,
    format: z
      .enum(['solo', 'solo_with_partners', 'couples'])
      .describe('What kind of contest this is.'),
  },
  toRequest: (args) => ({
    method: 'PUT',
    path: '/drafts/by-name/format',
    body: { contest: args.contest, format: args.format },
  }),
};

/**
 * `set_partner` — pairs two of a draft's people, or leaves one of them without a
 * partner. Always on both people at once: a partnership only one of them knows
 * about is a draft publishing rejects as not reciprocal.
 *
 * People are named the way the host says them. A name nobody has, and a name two
 * people share, are both refused with a reason rather than guessed at.
 */
const setPartner: McpTool = {
  name: 'set_partner',
  description:
    "Pair two of the people taking part in one of the host's contest DRAFTS, by their display names, or leave somebody without a partner by omitting `partner`. The pairing is set on BOTH people, and whoever either of them was previously paired with is left without a partner. Refused if nobody taking part has that name, if more than one person does (ask the host which), or if the two names are the same person.",
  destructive: false,
  scope: 'host',
  inputSchema: {
    contest: CONTEST_NAME,
    person: z.string().min(1).describe('The display name of the person whose partner is being set.'),
    partner: z
      .string()
      .optional()
      .describe('The display name of their partner. Omit to leave the person without one.'),
  },
  toRequest: (args) => ({
    method: 'PUT',
    path: '/drafts/by-name/partner',
    body: { contest: args.contest, person: args.person, partner: args.partner ?? null },
  }),
};

/** `get_draft` — reads one of the host's own contest drafts (still being prepared). */
const getDraft: McpTool = {
  name: 'get_draft',
  description:
    "Read one of the host's own contest DRAFTS by its name and return its current content. A published contest of the same name is not a draft and is not returned.",
  destructive: false,
  scope: 'host',
  inputSchema: { contest: CONTEST_NAME },
  toRequest: (args) => ({
    method: 'GET',
    path: `/drafts/by-name?name=${encodeURIComponent(String(args.contest))}`,
  }),
};

/** `get_tally` — reads the live tally of the host's contest: how many have claimed, are scoring, have sent. */
const getTally: McpTool = {
  name: 'get_tally',
  description:
    "Read the live tally of one of the host's contests: how many participants have claimed a place, are still scoring, and have sent their votes.",
  destructive: false,
  scope: 'host',
  inputSchema: { contest: CONTEST_NAME },
  toRequest: (args) => ({
    method: 'GET',
    path: `/contests/by-name/tally?name=${encodeURIComponent(String(args.contest))}`,
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
    contest: CONTEST_NAME,
    confirmationToken: CONFIRMATION_TOKEN,
  },
  toRequest: (args) => ({
    method: 'POST',
    path: '/contests/by-name/close',
    body: { contest: args.contest },
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
    // Optional on purpose: an id is internal identity, not something a host
    // states, so a model asked for "participants: Juan and Paco" has no id to
    // give. The API assigns one to any participant that arrives without it (see
    // `withParticipantIds`). Supply an existing id to keep referring to the same
    // person — that is what a partnership points at.
    id: z.string().min(1).optional().describe('Existing participant id; omit for a new participant.'),
    displayName: z.string().min(1),
    partnerId: z.string().min(1).optional(),
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
    format: z
      .enum(['solo', 'solo_with_partners', 'couples'])
      .optional()
      .describe(
        'What kind of contest this is, and the whole of what it says about who cooks and who may not score whom: "solo" — each person cooks their own dish and scores every other; "solo_with_partners" — each person cooks their own dish and whoever has a partner does not score their partner\'s; "couples" — each couple cooks one dish, everybody has a partner, and nobody scores their own couple\'s dish.',
      ),
    scoring: scoringShape.optional(),
    participants: z.array(personShape).optional(),
    closeRule: whenShape.optional(),
    revealStrategy: whenShape.optional(),
  },
  toRequest: (args) => ({ method: 'POST', path: '/drafts', body: args }),
};

/**
 * `rename_contest` — renames one of the host's drafts. Named for what it does:
 * as `update_draft` it promised every draft edit and delivered a rename, and a
 * model reading the catalogue would reasonably reach for it to change any part
 * of a draft.
 */
const renameContest: McpTool = {
  name: 'rename_contest',
  description:
    "Rename one of the host's contest DRAFTS, found by its current name. Only the name changes; nothing else about the draft is touched.",
  destructive: false,
  scope: 'host',
  inputSchema: {
    contest: CONTEST_NAME,
    name: z.string().min(1).describe('The new name for the draft.'),
  },
  toRequest: (args) => ({
    method: 'PATCH',
    path: '/drafts/by-name',
    body: { contest: args.contest, name: args.name },
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
    contest: CONTEST_NAME,
    confirmationToken: CONFIRMATION_TOKEN,
  },
  toRequest: (args) => ({
    method: 'POST',
    path: '/drafts/by-name/publish',
    body: { contest: args.contest },
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
    contest: CONTEST_NAME,
    confirmationToken: CONFIRMATION_TOKEN,
  },
  toRequest: (args) => ({
    method: 'POST',
    path: '/contests/by-name/reveal',
    body: { contest: args.contest },
  }),
};

/**
 * `delete_contest` — destroys one of the host's contests and everything in it.
 * The most destructive thing the surface offers and the only one with no undo,
 * so it is confirmation-gated like the rest.
 *
 * `confirmName` is not protocol ceremony: the API refuses (428) without the exact
 * contest name once anyone has claimed a place or cast a vote, so the assistant
 * must know and reproduce the name of the thing it is destroying. Because the
 * confirmation token is an HMAC over the arguments, a token issued for deleting
 * one contest cannot validate deleting another.
 */
const deleteContest: McpTool = {
  name: 'delete_contest',
  description:
    "Delete one of the host's own contests — a draft or a published one — together with its participants, dishes, scores and votes. Everything is destroyed and THIS CANNOT BE UNDONE. Once anyone has claimed a place or cast a vote, `confirmName` must be the contest's exact name.",
  destructive: true,
  scope: 'host',
  inputSchema: {
    contest: CONTEST_NAME,
    confirmName: z
      .string()
      .optional()
      .describe("The contest's exact name. Required once anyone has taken part in it."),
    confirmationToken: CONFIRMATION_TOKEN,
  },
  toRequest: (args) => {
    const path = `/contests/by-name?name=${encodeURIComponent(String(args.contest))}`;
    const name = args.confirmName;
    return {
      method: 'DELETE',
      path: name === undefined ? path : `${path}&confirm=${encodeURIComponent(String(name))}`,
    };
  },
};

/** `get_results` — reads the final results of one of the host's revealed contests. */
const getResults: McpTool = {
  name: 'get_results',
  description:
    "Read the final results — category totals and winners — of one of the host's contests. The contest must already be revealed.",
  destructive: false,
  scope: 'host',
  inputSchema: { contest: CONTEST_NAME },
  toRequest: (args) => ({
    method: 'GET',
    path: `/contests/by-name/results?name=${encodeURIComponent(String(args.contest))}`,
  }),
};

/** The tools the MCP server exposes. Grows one vertical slice at a time (design.md §6.1). */
export const TOOL_CATALOG: readonly McpTool[] = [
  getContest,
  listMyContests,
  findContest,
  getContestDetails,
  addParticipant,
  removeParticipant,
  addCategory,
  removeCategory,
  setScoreRange,
  setScoreUniqueness,
  setFormat,
  setPartner,
  getDraft,
  getTally,
  closeContest,
  createDraft,
  renameContest,
  publishContest,
  triggerReveal,
  deleteContest,
  getResults,
];

/**
 * Validates a proposed tool call's arguments against that tool's own input
 * schema, returning the parsed arguments.
 *
 * The MCP server gets this for free — it hands `inputSchema` to the SDK, which
 * validates before the tool runs. The in-app assistant dispatches tool calls
 * itself, so without this the model's arguments reached the API unchecked: a
 * malformed call was stored rather than refused (that is how drafts came to hold
 * participants with no id). Both entry points now apply the same schema.
 *
 * Unknown keys are stripped rather than rejected: only fields the tool declares
 * are forwarded, so a model that volunteers an extra field is tidied up, not
 * refused — the same "read only known fields" discipline the draft guard uses.
 */
export function parseToolArguments(
  tool: McpTool,
  args: Record<string, unknown>,
): { readonly ok: true; readonly args: Record<string, unknown> } | { readonly ok: false; readonly message: string } {
  const parsed = z.object(tool.inputSchema).safeParse(args);
  if (parsed.success) return { ok: true, args: parsed.data as Record<string, unknown> };
  const detail = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
  return { ok: false, message: detail };
}
