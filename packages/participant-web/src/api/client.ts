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
