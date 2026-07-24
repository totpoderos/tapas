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

async function send(path: string, method: 'GET' | 'POST' | 'PATCH', body?: unknown): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
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
 * Publishes a draft into a live contest. On failure the thrown `ApiError` carries
 * the API's host-facing reason (e.g. the draft is incomplete), which the caller
 * surfaces to the host. Returns the new live contest's id.
 */
export async function publishDraft(id: string): Promise<string> {
  const response = await send(`/drafts/${encodeURIComponent(id)}/publish`, 'POST');
  if (!response.ok) throw await errorFrom(response);
  return ((await response.json()) as { id: string }).id;
}
