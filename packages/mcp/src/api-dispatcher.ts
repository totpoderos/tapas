/**
 * The one thing the MCP adapter actually does: turn a tool's intended
 * `ApiRequest` into an HTTP call against the backend API, carrying the host's
 * personal access token, and hand back the raw outcome. It makes no
 * authorization or business decision of its own (design.md §6.3) — the API
 * owns those. Failures are returned, not thrown, so a tool handler can relay
 * them to the model as an ordinary result.
 */

export interface ApiRequest {
  // PUT joined the rest when the assistant gained the draft edits that replace a
  // setting outright — a score range is set, not merged into.
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** API path beginning with `/`, e.g. `/contests/abc`. */
  readonly path: string;
  readonly body?: unknown;
}

export interface DispatchResult {
  readonly ok: boolean;
  readonly status: number;
  /** Parsed JSON body, or undefined when the response had none. */
  readonly body: unknown;
}

export interface ApiDispatcherDeps {
  readonly apiBaseUrl: string;
  /** The host-issued personal access token this connection acts as. */
  readonly hostToken: string;
  /** Injectable so unit tests need no real socket; defaults to the global fetch. */
  readonly fetch?: typeof fetch;
}

export async function dispatchToApi(
  deps: ApiDispatcherDeps,
  request: ApiRequest,
): Promise<DispatchResult> {
  const doFetch = deps.fetch ?? fetch;
  const headers: Record<string, string> = { authorization: `Bearer ${deps.hostToken}` };
  if (request.body !== undefined) headers['content-type'] = 'application/json';

  const response = await doFetch(`${deps.apiBaseUrl}${request.path}`, {
    method: request.method,
    headers,
    body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
  });

  const body = await response.json().catch(() => undefined);
  return { ok: response.ok, status: response.status, body };
}
