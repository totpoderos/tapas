/**
 * The host app's typed door to the backend API. Requests go same-origin by
 * default (a dev/preview proxy forwards `/auth` and `/drafts` to the API), so
 * the session cookie is first-party and `credentials: 'include'` carries it —
 * the token is never in JS (XSS-safe, design.md §11B.1). Set `VITE_API_BASE_URL`
 * to talk to a different origin (relies on the API's CORS allowlist).
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

/** A failed API call — carries the HTTP status and the API's error code when present. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
    message?: string,
  ) {
    super(message ?? `Request failed (${status})`);
    this.name = 'ApiError';
  }
}

async function send(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const headers: Record<string, string> = { ...extraHeaders };
  if (body !== undefined) headers['content-type'] = 'application/json';
  return fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function errorFrom(response: Response): Promise<ApiError> {
  const parsed = (await response.json().catch(() => undefined)) as
    | { error?: { code?: string; message?: string } }
    | undefined;
  return new ApiError(response.status, parsed?.error?.code, parsed?.error?.message);
}

export async function register(email: string, password: string): Promise<void> {
  const response = await send('/auth/register', 'POST', { email, password });
  if (!response.ok) throw await errorFrom(response);
}

export async function signIn(email: string, password: string): Promise<void> {
  const response = await send('/auth/login', 'POST', { email, password });
  if (!response.ok) throw await errorFrom(response);
}

/** Who an invitation was sent to. Refuses identically for every reason a link cannot be used. */
export async function readInvitation(token: string): Promise<{ email: string }> {
  const response = await send(`/invites/${encodeURIComponent(token)}`, 'GET');
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as { email: string };
}

/** Turns an invitation into an account. Grants no session — the caller signs in afterwards. */
export async function acceptInvitation(token: string, password: string): Promise<void> {
  const response = await send(`/invites/${encodeURIComponent(token)}/accept`, 'POST', { password });
  if (!response.ok) throw await errorFrom(response);
}

/** Whether this deployment still has no administrator. Anonymous — the first-run screen must know. */
export async function isDeploymentUnclaimed(): Promise<boolean> {
  const response = await send('/setup/admin', 'GET');
  if (!response.ok) throw await errorFrom(response);
  return ((await response.json()) as { unclaimed: boolean }).unclaimed;
}

/**
 * Claims an unclaimed deployment for the configured address. Reports whether the
 * message went out, and hands back the link when it did not — the only copy
 * there is, since nothing stores it.
 */
export async function claimDeployment(
  email: string,
): Promise<{ messageSent: boolean; link?: string }> {
  const response = await send('/setup/admin', 'POST', { email });
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as { messageSent: boolean; link?: string };
}

export async function signOut(): Promise<void> {
  await send('/auth/logout', 'POST');
}

/** Whether there is a valid host session right now — probed via an authenticated read. */
export async function hasSession(): Promise<boolean> {
  const response = await send('/drafts', 'GET');
  return response.ok;
}

/** A one-line view of a host's contest, whatever state it is in — the contest list's rows. */
export interface ContestSummary {
  readonly id: string;
  readonly name: string;
  readonly status: 'draft' | 'live' | 'closed' | 'revealed';
  readonly updatedAt: string;
}

/** Every contest the signed-in host owns, most recently touched first. */
export async function listContests(): Promise<ContestSummary[]> {
  const response = await send('/contests', 'GET');
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as ContestSummary[];
}

/** How a dish is credited: to each cook, or to a couple as a pair. */
export type Attribution = 'per_person' | 'per_couple';
/** Which same-side scoring is barred, to guard against bias. */
export type AntiBias = 'none' | 'couples' | 'arbitrary_pairs';
/** The score band voters use: derived automatically, or a fixed min–max. */
export type ScoreRange = { readonly type: 'auto' } | { readonly type: 'fixed'; readonly min: number; readonly max: number };

export interface ScoringConfig {
  readonly categories: readonly { readonly id: string; readonly name: string }[];
  readonly range: ScoreRange;
  readonly uniquePerCategory: boolean;
}

export interface Participant {
  readonly id: string;
  readonly displayName: string;
  /** The id of this participant's partner, when they are scored as a couple. */
  readonly partnerId?: string;
  /** Ids of participants this one may not score (anti-bias). */
  readonly noScoreWith?: readonly string[];
}

/** The editable content of a draft. Only `name` is required; the rest is filled over time. */
export interface DraftContent {
  readonly name: string;
  readonly attribution?: Attribution;
  readonly antiBias?: AntiBias;
  readonly scoring?: ScoringConfig;
  readonly participants?: readonly Participant[];
}

/** Saves a new contest draft; throws ApiError (e.g. a name is required). Returns the draft's id. */
export async function createDraft(content: DraftContent): Promise<string> {
  const response = await send('/drafts', 'POST', content);
  if (!response.ok) throw await errorFrom(response);
  return ((await response.json()) as { id: string }).id;
}

/** A stored draft, as returned when reading one for review. */
export interface StoredDraft {
  readonly id: string;
  readonly content: DraftContent;
  readonly status: 'draft';
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Reads one of the host's drafts for review; throws ApiError (404 when it isn't theirs / doesn't exist). */
export async function getDraft(id: string): Promise<StoredDraft> {
  const response = await send(`/drafts/${encodeURIComponent(id)}`, 'GET');
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as StoredDraft;
}

/** Renames a draft; throws ApiError. Returns nothing — the caller re-reads or navigates. */
export async function renameDraft(id: string, name: string): Promise<void> {
  const response = await send(`/drafts/${encodeURIComponent(id)}`, 'PATCH', { name });
  if (!response.ok) throw await errorFrom(response);
}

/**
 * Replaces a draft's whole content — real editing, not just the name. Throws
 * ApiError (e.g. a name is required). The draft may be incomplete; the full
 * rules are checked at publish.
 */
export async function updateDraft(id: string, content: DraftContent): Promise<void> {
  const response = await send(`/drafts/${encodeURIComponent(id)}`, 'PUT', content);
  if (!response.ok) throw await errorFrom(response);
}

/**
 * Publishes a draft into a live contest. On failure the thrown `ApiError` carries
 * the API's host-facing reason (e.g. the draft is incomplete), which the caller
 * surfaces to the host. Returns the new live contest's id.
 */
export async function publishDraft(id: string): Promise<string> {
  const response = await send(`/drafts/${encodeURIComponent(id)}/publish`, 'POST');
  if (!response.ok) throw await errorFrom(response);
  return ((await response.json()) as { id: string }).id;
}

/** A single message in the assistant conversation. */
export interface AssistantMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

/** A destructive action the host is being asked to confirm — echoed back verbatim to confirm it. */
export interface PendingAction {
  readonly action: string;
  readonly args: Record<string, unknown>;
  readonly confirmationToken: string;
}

/** The assistant's response to one turn: a plain reply, a carried-out action, or a confirmation request. */
export type AssistantTurn =
  | { readonly kind: 'reply'; readonly text: string }
  | { readonly kind: 'result'; readonly action: string; readonly text: string; readonly result: unknown }
  | { readonly kind: 'failed'; readonly action: string; readonly message: string }
  | ({ readonly kind: 'confirm'; readonly message: string } & PendingAction);

async function assistant(body: unknown): Promise<AssistantTurn> {
  const response = await send('/assistant/messages', 'POST', body);
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as AssistantTurn;
}

/** Sends the conversation so far and returns the assistant's next turn. */
export async function sendAssistantMessage(messages: readonly AssistantMessage[]): Promise<AssistantTurn> {
  return assistant({ messages });
}

/** One recorded action on a contest — a projection of a domain event (design.md §5). */
export interface AuditEntry {
  readonly id: string;
  readonly type: string;
  readonly actorId: string;
  readonly sourcePath: 'form' | 'mcp' | 'system';
  readonly toolName?: string;
  readonly toolArgs?: unknown;
  readonly confirmation?: 'host' | 'auto';
  readonly occurredAt: string;
}

/** Reads a contest's activity log, oldest action first; throws ApiError (404/403 when not the host's). */
export async function getAuditLog(contestId: string): Promise<AuditEntry[]> {
  const response = await send(`/contests/${encodeURIComponent(contestId)}/audit`, 'GET');
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as AuditEntry[];
}

/** The live-contest control view of a contest a host owns. */
export interface ContestDetail {
  readonly id: string;
  readonly name: string;
  readonly status: 'live' | 'closed' | 'revealed';
  readonly joinCode: string;
}

/** How the contest is progressing: who has joined, is still scoring, and has sent their vote. */
export interface Tally {
  readonly claimedCount: number;
  readonly draftCount: number;
  readonly sentCount: number;
}

/** Reads a contest the host owns; throws ApiError (404/403 when not theirs). */
export async function getContest(id: string): Promise<ContestDetail> {
  const response = await send(`/contests/${encodeURIComponent(id)}`, 'GET');
  if (!response.ok) throw await errorFrom(response);
  const dto = (await response.json()) as ContestDetail;
  return { id: dto.id, name: dto.name, status: dto.status, joinCode: dto.joinCode };
}

/** Reads the live tally of a contest the host owns. */
export async function getTally(id: string): Promise<Tally> {
  const response = await send(`/contests/${encodeURIComponent(id)}/tally`, 'GET');
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as Tally;
}

// The host is confirming in the UI, so these carry the host-confirmation marker —
// the audit log records the close/reveal as confirmed by the host (design.md §7.1).
const HOST_CONFIRMED = { 'x-tapas-confirmation': 'host' };

/** Closes voting on a live contest (host-confirmed); throws ApiError. */
export async function closeContest(id: string): Promise<void> {
  const response = await send(`/contests/${encodeURIComponent(id)}/close`, 'POST', undefined, HOST_CONFIRMED);
  if (!response.ok) throw await errorFrom(response);
}

/** Reveals a closed contest (host-confirmed); throws ApiError. */
export async function revealContest(id: string): Promise<void> {
  const response = await send(`/contests/${encodeURIComponent(id)}/reveal`, 'POST', undefined, HOST_CONFIRMED);
  if (!response.ok) throw await errorFrom(response);
}

/** A dish's place on a reveal leaderboard. */
export interface Standing {
  readonly dishId: string;
  readonly name: string;
  readonly total: number;
}
export interface Winner {
  readonly dishId: string;
  readonly name: string;
}

/** The revealed results: winners and leaderboards, by dish name — the same view a participant reads. */
export interface Reveal {
  readonly contestName: string;
  readonly overall: { readonly winners: readonly Winner[]; readonly standings: readonly Standing[] };
  readonly categories: readonly {
    readonly categoryId: string;
    readonly name: string;
    readonly winners: readonly Winner[];
    readonly standings: readonly Standing[];
  }[];
}

/**
 * Reads the results of a contest the host owns, or `null` while it has not been
 * revealed yet — the same 409 the participant's reading answers with, so the two
 * screens can treat "not out yet" identically.
 *
 * `/winners` rather than `/reveal`: that path already belongs to the participant's
 * GET and to the POST that triggers the reveal.
 */
export async function getWinners(contestId: string): Promise<Reveal | null> {
  const response = await send(`/contests/${encodeURIComponent(contestId)}/winners`, 'GET');
  if (response.status === 409) return null; // not revealed yet
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as Reveal;
}

/**
 * Deletes a contest the host owns — a draft or a published one, same route.
 *
 * `confirmName` carries the typed-name confirmation. **Whether it is required is
 * the API's call, not this app's**: once anyone has claimed a place or cast a
 * vote it answers 428 `CONFIRMATION_REQUIRED`, and the UI escalates to asking for
 * the name. Duplicating that rule here would give two places to keep in step, and
 * the one in the browser is the one an assistant or MCP client never passes
 * through.
 */
export async function deleteContest(id: string, confirmName?: string): Promise<void> {
  const query = confirmName === undefined ? '' : `?confirm=${encodeURIComponent(confirmName)}`;
  const response = await send(
    `/contests/${encodeURIComponent(id)}${query}`,
    'DELETE',
    undefined,
    HOST_CONFIRMED,
  );
  if (!response.ok) throw await errorFrom(response);
}

/** True when the API is asking for the contest's name before it will delete it. */
export function needsNameToDelete(caught: unknown): boolean {
  return caught instanceof ApiError && caught.status === 428;
}

/** Confirms a destructive action the assistant asked about, carrying it out. */
export async function confirmAssistantAction(pending: PendingAction): Promise<AssistantTurn> {
  return assistant({ confirm: pending });
}
