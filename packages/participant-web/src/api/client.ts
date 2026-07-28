/**
 * The participant app's typed door to the backend API. Requests go same-origin
 * by default (a dev/preview proxy forwards `/contests` to the API), so the voter
 * cookie is first-party and `credentials: 'include'` carries it — the token is
 * never in JS. Set `VITE_API_BASE_URL` to talk to a different origin.
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

async function send(path: string, method: 'GET' | 'POST', body?: unknown): Promise<Response> {
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

/**
 * True when the host has deleted the contest out from under this participant.
 *
 * The API answers `410 Gone` rather than `404` on the voter-scoped routes: a
 * voter token proves prior association with that contest, so naming it reveals
 * nothing they did not already know. It lets the app say "this is gone" instead
 * of showing a generic failure or spinning forever.
 */
export function isContestDeleted(caught: unknown): boolean {
  return caught instanceof ApiError && caught.status === 410;
}

/** One open place on a contest's roster: a participant a joiner can claim to be. */
export interface Place {
  readonly participantId: string;
  readonly displayName: string;
}

export interface OpenPlaces {
  readonly contestId: string;
  readonly places: readonly Place[];
}

/** Who a joined participant is, on a contest. */
export interface Identity {
  readonly participantId: string;
  readonly contestId: string;
  readonly displayName: string;
}

/** Looks up the still-open places for a join code; throws ApiError (404 when the code is unknown). */
export async function getPlaces(joinCode: string): Promise<OpenPlaces> {
  const response = await send(`/contests/${encodeURIComponent(joinCode)}/places`, 'GET');
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as OpenPlaces;
}

/** Claims a place by the join code, becoming that participant; throws ApiError (409 when taken). */
export async function claimPlace(joinCode: string, participantId: string): Promise<Identity> {
  const response = await send(`/contests/${encodeURIComponent(joinCode)}/claim`, 'POST', { participantId });
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as Identity;
}

/** The participant this device is remembered as on the given contest, or null if not recognised. */
export async function getMe(contestId: string): Promise<Identity | null> {
  const response = await send(`/contests/${encodeURIComponent(contestId)}/me`, 'GET');
  if (response.status === 401) return null;
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as Identity;
}

/** A dish a cook has submitted. `submitterIds` says whose it is (a couple may share one). */
export interface Dish {
  readonly dishId: string;
  readonly name: string;
  readonly description: string | null;
  readonly submitterIds: readonly string[];
}

/** The dishes submitted so far in the contest. */
export async function getDishes(contestId: string): Promise<Dish[]> {
  const response = await send(`/contests/${encodeURIComponent(contestId)}/dishes`, 'GET');
  if (!response.ok) throw await errorFrom(response);
  return ((await response.json()) as { dishes: Dish[] }).dishes;
}

/** Submits (or revises) the participant's own dish; throws ApiError (e.g. a name is required). */
export async function submitDish(
  contestId: string,
  dish: { name: string; description?: string },
): Promise<Dish> {
  const response = await send(`/contests/${encodeURIComponent(contestId)}/dishes`, 'POST', dish);
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as Dish;
}

/** The voter's ballot — what they may score, derived from the compiled constraint view. */
export interface Ballot {
  readonly contestId: string;
  readonly dishes: readonly { readonly dishId: string; readonly name: string }[];
  readonly categories: readonly { readonly id: string; readonly name: string }[];
  readonly range: { readonly min: number; readonly max: number };
  readonly uniquePerCategory: boolean;
}

/** One draft score the voter has saved. */
export interface Score {
  readonly dishId: string;
  readonly categoryId: string;
  readonly value: number;
}

/** Reads the voter's ballot; throws ApiError (401 when they haven't claimed a place). */
export async function getBallot(contestId: string): Promise<Ballot> {
  const response = await send(`/contests/${encodeURIComponent(contestId)}/ballot`, 'GET');
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as Ballot;
}

/** Reads the scores the voter has saved so far. */
export async function getMyScores(contestId: string): Promise<Score[]> {
  const response = await send(`/contests/${encodeURIComponent(contestId)}/scores`, 'GET');
  if (!response.ok) throw await errorFrom(response);
  return ((await response.json()) as { scores: Score[] }).scores;
}

/** Saves (or revises) one draft score; throws ApiError (e.g. out of range, or the vote is sent). */
export async function saveScore(contestId: string, score: Score): Promise<void> {
  const response = await send(`/contests/${encodeURIComponent(contestId)}/scores`, 'POST', score);
  if (!response.ok) throw await errorFrom(response);
}

/** Sends (locks) the vote; throws ApiError (e.g. incomplete, or already sent). */
export async function sendVote(contestId: string): Promise<void> {
  const response = await send(`/contests/${encodeURIComponent(contestId)}/send-vote`, 'POST');
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

/** The revealed results: winners and leaderboards, by dish name. */
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
 * Reads the revealed results, or `null` while the contest hasn't been revealed
 * yet (the app polls on that). Throws ApiError for other failures (401 when the
 * caller hasn't claimed a place).
 */
export async function getReveal(contestId: string): Promise<Reveal | null> {
  const response = await send(`/contests/${encodeURIComponent(contestId)}/reveal`, 'GET');
  if (response.status === 409) return null; // not revealed yet
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as Reveal;
}
