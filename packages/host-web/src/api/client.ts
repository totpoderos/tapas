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

/**
 * Where a refusal means "wrong password", not "your session aged out". Renewing
 * for a refused sign-in would fire a refresh at every typo, and renewing for a
 * refused renewal would recurse into itself.
 */
const NEVER_RENEWED_FOR = new Set(['/auth/login', '/auth/refresh']);

/**
 * The renewal in flight, if there is one — shared by everybody who finds the
 * session aged out while it runs.
 *
 * This is a correctness device, not a saving. The API revokes a refresh token
 * as it spends it, so a second renewal raised in the same moment presents
 * something already revoked, is refused, and ends the session it was raised to
 * save. Any screen that asks for two things at once would find that.
 *
 * Module scope rather than React state: one renewal per tab is the requirement,
 * and a screen outside the session provider (accepting an invitation) has to
 * share the same one. The slot is cleared when the renewal settles, so the next
 * expiry starts a fresh one.
 */
let renewal: Promise<boolean> | null = null;

/**
 * The same exclusion across tabs, which a promise in one tab's memory cannot
 * give. Two tabs renewing together were measured signing *both* of themselves
 * out: the winner is given fresh cookies, the loser is refused — and the API
 * clears both cookies as it refuses, into a jar the two tabs share, so the
 * loser's refusal wipes the winner's new session.
 *
 * Held across the renewal, so the second tab renews after the first rather than
 * beside it. By then the cookie it presents is the fresh one, so it is not
 * refused and nothing is cleared. It does spend a second rotation the session
 * did not need; harmless, since the jar the tabs share ends up holding the
 * newest token either way.
 *
 * Absent in older browsers and in the test environment, where the per-tab slot
 * above is what there is — which is the behaviour this had before the lock.
 */
const RENEWAL_LOCK = 'tapas-host-session-renewal';

async function underRenewalLock(work: () => Promise<boolean>): Promise<boolean> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks) return work();
  // Awaited rather than returned: the lock manager holds the lock until the
  // callback's promise settles, but the DOM types describe the callback as
  // returning a plain value, so what they infer here is a promise of a promise.
  return await locks.request(RENEWAL_LOCK, work);
}

/**
 * What the tabs tell each other: a fresh mark every time one of them renews.
 *
 * Taking turns is not enough on its own, which cost a measurement to learn. Two
 * tabs renewing one after the other are both answered 200 — and the second
 * rotation revokes the session the first was just given, so the first tab's
 * retry carries an access token that has stopped being valid and is refused.
 * Taking turns moved the casualty rather than removing one.
 *
 * So a tab that waited compares this mark against what it saw before queueing.
 * A different mark means another tab has already renewed and its cookies are in
 * the jar they share — which is the only thing this tab needed.
 *
 * Storage that refuses to answer costs a redundant rotation, which is where
 * this started. It never costs anything in a single tab.
 */
const RENEWAL_MARK = 'tapas-host-session-renewed';

function renewalMark(): string {
  try {
    return localStorage.getItem(RENEWAL_MARK) ?? '';
  } catch {
    return '';
  }
}

function markRenewed(): void {
  try {
    localStorage.setItem(RENEWAL_MARK, globalThis.crypto?.randomUUID?.() ?? String(Date.now()));
  } catch {
    // Nothing to tell the other tabs with. See above.
  }
}

/** Spends the refresh cookie for a fresh session. Answers whether it worked; never throws. */
function renewSession(): Promise<boolean> {
  const markBeforeQueueing = renewalMark();
  renewal ??= underRenewalLock(async () => {
    // Somebody else renewed while this tab waited its turn. Renewing again
    // would revoke what they were given, and take this tab's own retry with it.
    if (renewalMark() !== markBeforeQueueing) return true;
    const response = await send('/auth/refresh', 'POST');
    if (response.ok) markRenewed();
    return response.ok;
  })
    // A lock that cannot be taken must not become an exception thrown from
    // whatever ordinary request happened to find the session aged out.
    .catch(() => false)
    .finally(() => {
      renewal = null;
    });
  return renewal;
}

/**
 * Every call the app makes goes through here, which is why the renewal lives
 * here: it covers the read that decides who is signed in on a reload — the one
 * whose refusal used to put a working host on the sign-in screen — without any
 * caller knowing, or being able to forget.
 *
 * `alreadyRenewed` bounds it to one attempt per call. A 401 that is not about
 * expiry — work that is not this host's to do, an account whose standing
 * changed — would otherwise renew and retry until the refresh token died.
 */
async function send(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body?: unknown,
  extraHeaders?: Record<string, string>,
  alreadyRenewed = false,
): Promise<Response> {
  const headers: Record<string, string> = { ...extraHeaders };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status !== 401 || alreadyRenewed || NEVER_RENEWED_FOR.has(path)) return response;
  // A refused renewal is the session being over: the API clears both cookies as
  // it refuses, so the refusal is handed back and the app's own paths take it
  // to sign-in from here.
  if (!(await renewSession())) return response;
  return send(path, method, body, extraHeaders, true);
}

async function errorFrom(response: Response): Promise<ApiError> {
  const parsed = (await response.json().catch(() => undefined)) as
    | { error?: { code?: string; message?: string } }
    | undefined;
  return new ApiError(response.status, parsed?.error?.code, parsed?.error?.message);
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

/**
 * Who is signed in, and what they are — or `null` if nobody is.
 *
 * One read answers both. It replaced a probe that fetched a list of drafts only
 * to discard it, and which could not have reported the role at all.
 *
 * The role is for deciding what to draw. Nothing is authorized by it: the API
 * reads the account store when it matters, because a refresh carries the
 * previous token's claim forward and a claim-derived role would outlive a
 * demotion.
 *
 * Deliberately not discovered by requesting something administrative and
 * reading the refusal — that would record a refused administrative attempt for
 * every ordinary host on every page load.
 */
export async function whoAmI(): Promise<{ hostId: string; role: string } | null> {
  const response = await send('/auth/me', 'GET');
  if (!response.ok) return null;
  return (await response.json()) as { hostId: string; role: string };
}

/** Every host account, for an administrator. */
export async function listHostAccounts(): Promise<
  { email: string; isAdministrator: boolean }[]
> {
  const response = await send('/admin/hosts', 'GET');
  if (!response.ok) throw await errorFrom(response);
  return ((await response.json()) as { hosts: { email: string; isAdministrator: boolean }[] })
    .hosts;
}

/** Every invitation, for an administrator. Never carries a link — nothing stores one. */
export async function listInvitations(): Promise<
  { id: string; email: string; status: string; issuedAt: string }[]
> {
  const response = await send('/admin/invites', 'GET');
  if (!response.ok) throw await errorFrom(response);
  return (
    (await response.json()) as {
      invitations: { id: string; email: string; status: string; issuedAt: string }[];
    }
  ).invitations;
}

/** Invites an address. The link comes back only when no mail server would take the message. */
export async function inviteHost(
  email: string,
): Promise<{ invitationId: string; messageSent: boolean; link?: string }> {
  const response = await send('/admin/invites', 'POST', { email });
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as {
    invitationId: string;
    messageSent: boolean;
    link?: string;
  };
}

export async function revokeInvitation(id: string): Promise<void> {
  const response = await send(`/admin/invites/${encodeURIComponent(id)}/revoke`, 'POST');
  if (!response.ok) throw await errorFrom(response);
}

export async function resendInvitation(
  id: string,
): Promise<{ invitationId: string; messageSent: boolean; link?: string }> {
  const response = await send(`/admin/invites/${encodeURIComponent(id)}/resend`, 'POST');
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as {
    invitationId: string;
    messageSent: boolean;
    link?: string;
  };
}

/** How far along a contest's voting is: who has joined, and who has sent. */
export interface ContestProgress {
  readonly claimedCount: number;
  readonly draftCount: number;
  readonly sentCount: number;
}

/**
 * A one-line view of a host's contest, whatever state it is in — the contest
 * list's rows.
 *
 * Everything past `updatedAt` is optional, and **absent means not applicable
 * yet, not zero**. A contest still being prepared has no join code and no
 * progress: the screen must say "not published" rather than "nobody has voted",
 * because those are different facts and only one of them is true.
 */
export interface ContestSummary {
  readonly id: string;
  readonly name: string;
  readonly status: 'draft' | 'live' | 'closed' | 'revealed';
  readonly updatedAt: string;
  /** What a dish is credited to. Absent when the contest does not say. */
  readonly attribution?: Attribution;
  /** How many things each dish is judged on. Absent when none have been chosen. */
  readonly categoryCount?: number;
  /** The code people join with. Absent until the contest is published. */
  readonly joinCode?: string;
  /** How the voting is going. Absent until the contest is published. */
  readonly progress?: ContestProgress;
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

/**
 * The same log as a file, with the name the server gave it.
 *
 * Fetched rather than linked so a refusal arrives as an `ApiError` the panel can
 * render in place. A plain `<a download>` would hand a 403 to the browser, which
 * would replace the screen with whatever it made of the response body.
 */
export async function getAuditLogFile(
  contestId: string,
): Promise<{ blob: Blob; filename: string }> {
  const response = await send(`/contests/${encodeURIComponent(contestId)}/audit?format=csv`, 'GET');
  if (!response.ok) throw await errorFrom(response);
  return {
    blob: await response.blob(),
    // The server decides what the file is called; this only reads it back out.
    filename: filenameFrom(response.headers.get('content-disposition')),
  };
}

/** The filename from a Content-Disposition header, or a plain fallback. */
function filenameFrom(header: string | null): string {
  const quoted = header?.match(/filename="([^"]+)"/);
  return quoted?.[1] ?? 'activity-log.csv';
}

/**
 * The rules a published contest is being played by.
 *
 * Read from the contest rather than from the draft, which is retired at publish
 * and no longer exists. `attribution` and `antiBias` are absent on a contest
 * published before they were recorded — which reads as "does not say", and in
 * `antiBias`'s case must never be shown as `'none'`, since that is itself a rule
 * a host can choose.
 */
export interface ContestRules {
  readonly attribution?: Attribution;
  readonly antiBias?: AntiBias;
  readonly categories: readonly { readonly id: string; readonly name: string }[];
  readonly uniquePerCategory: boolean;
  /** The band every judge scores in. Absent when the contest has no participants to derive it from. */
  readonly scoreRange?: { readonly min: number; readonly max: number };
}

/** The live-contest control view of a contest a host owns. */
export interface ContestDetail {
  readonly id: string;
  readonly name: string;
  readonly status: 'live' | 'closed' | 'revealed';
  readonly joinCode: string;
  readonly rules: ContestRules;
}

/** How the contest is progressing: how many places there are, and who has done what. */
export interface Tally {
  /** How many places the roster holds — what the rest of these are out of. */
  readonly placeCount: number;
  readonly claimedCount: number;
  readonly draftCount: number;
  readonly sentCount: number;
}

/** The contest as the API sends it: the stored contest, with its compiled view flattened. */
interface ContestDetailDto extends Omit<ContestDetail, 'rules'> {
  readonly attribution?: Attribution;
  readonly antiBias?: AntiBias;
  readonly materialized: {
    readonly uniquePerCategory: boolean;
    readonly categories: readonly { readonly id: string; readonly name: string }[];
    readonly scoreRangeByVoter: Record<string, { readonly min: number; readonly max: number }>;
  };
}

/** Reads a contest the host owns; throws ApiError (404/403 when not theirs). */
export async function getContest(id: string): Promise<ContestDetail> {
  const response = await send(`/contests/${encodeURIComponent(id)}`, 'GET');
  if (!response.ok) throw await errorFrom(response);
  const dto = (await response.json()) as ContestDetailDto;
  // Score bounds are per judge but uniform across a contest (see the domain's
  // `MaterializedContest`), so any judge's band is the contest's. A contest with
  // no participants has none to read, and says nothing rather than inventing one.
  const [bounds] = Object.values(dto.materialized.scoreRangeByVoter);
  return {
    id: dto.id,
    name: dto.name,
    status: dto.status,
    joinCode: dto.joinCode,
    rules: {
      ...(dto.attribution === undefined ? {} : { attribution: dto.attribution }),
      ...(dto.antiBias === undefined ? {} : { antiBias: dto.antiBias }),
      categories: dto.materialized.categories,
      uniquePerCategory: dto.materialized.uniquePerCategory,
      ...(bounds === undefined ? {} : { scoreRange: { min: bounds.min, max: bounds.max } }),
    },
  };
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
