## Context

The API issues a 15-minute access token and a 7-day refresh token, both in
httpOnly cookies, and `POST /auth/refresh` rotates them: the presented refresh
token is revoked before the replacement is issued. That is built, specified, and
covered by acceptance tests.

No browser code calls it. The only caller of `/auth/refresh` in the repository is
the API's own acceptance test. So the refresh cookie sits in the browser for
seven days, unspent, while the access cookie ages out after fifteen minutes.

What the host sees: the session read on mount is refused, the session goes
anonymous, and the router sends them to sign-in. Without a reload it is quieter
and worse — individual calls fail and each screen reports its own generic error.

The constraint that shapes everything below is the rotation. Two refreshes raised
at the same instant are not a wasted request; the second presents a token the
first has already revoked, is refused, and ends the session.

## Goals / Non-Goals

**Goals:**

- A host at work is not returned to sign-in by an aged-out session.
- The mount-time "who is signed in" read is covered, since that is what produces
  the visible bounce.
- Concurrent refusals cause exactly one renewal.
- A genuinely dead session still reaches sign-in, promptly.

**Non-Goals:**

- Changing the access or refresh lifetimes. Fifteen minutes is right precisely
  because renewal is cheap and silent.
- The participant app. A voter holds one long-lived token with no split, so
  there is nothing to renew.
- Proactive renewal on a timer. Considered and rejected below.
- Telling a host their session ended. Worth doing, but it is a screen with words
  in two languages, and it is not this change.

## Decisions

### Renew reactively, inside the shared request helper

Every call in the host app already goes through one `send()` in
`packages/host-web/src/api/client.ts`. Putting the renewal there covers all of
them, including `whoAmI()`, with no caller changing and no caller able to forget.

The shape: on a 401, await the single-flighted renewal; if it succeeds, replay
the original request exactly once and return whatever that gives.

*Alternative — a timer at ~13 minutes.* Rejected. It has to survive a
backgrounded tab, where browsers throttle timers hard, and a laptop that was
asleep; both put it back in the same 401 it was meant to avoid, so it needs the
reactive path anyway. Two mechanisms, one outcome, and both racing for the same
single-use token.

*Alternative — renewing in the session provider.* Rejected. It only knows about
the calls it makes itself, so every other screen keeps failing, and it cannot see
a 401 raised by a page's own fetch.

### Single-flight with a module-level promise

One module-scoped `Promise | null`. The first 401 starts the renewal and stores
the promise; every 401 arriving while it is in flight awaits that same promise;
the slot is cleared when it settles. This is the ordinary shape and it is enough
here: JavaScript is single-threaded, so between reading the slot and writing it
nothing else runs, and there is no interleaving to protect against.

Module scope, not React state or a ref: the requirement is one renewal per
browser tab, not one per component tree. A ref inside the provider would give a
second renewal to anything rendered outside it, which is where the accept-invite
screen lives.

### A Web Lock over that, and a mark the tabs leave each other

A promise in one tab's memory says nothing to another tab, and the two share a
cookie jar. `navigator.locks.request` is the same single-flight in browser scope
rather than module scope, so the renewal is taken one tab at a time — and a mark
in `localStorage`, written on every successful renewal, is how the tab that
waited learns it no longer needs to renew at all.

Both parts are load-bearing, and it took measuring to find out why. The lock
alone still lost a session: a *serialised* second rotation revokes the token the
first tab was about to retry with. The mark alone would be a check with no
atomicity between the looking and the acting. See the risk below for the wire
logs on either side of it.

The module slot stays underneath both. It answers the common case — one tab,
several requests — without going near the lock manager, and it is the whole
mechanism where Web Locks or storage are unavailable.

*Alternative — `BroadcastChannel`, or a lock built in `localStorage`.* Rejected.
Both mean writing the mutual exclusion by hand, including its timeouts and its
crashed-tab recovery, which is exactly what the lock manager already does
correctly.

All of this was scoped out when the design was written, and pulled back in after
the two-tab case was measured rather than reasoned about — twice, since the
first fix for it was also reasoned about rather than measured.

### Retry the original request once, and only once

A single boolean carried through the retry. Work still refused after a renewal is
returned to the caller as it stands.

Without it, a 401 that has nothing to do with expiry — a signed-out session, an
account whose standing changed — renews, retries, is refused, renews again. The
loop is bounded only by the refresh token dying.

### `/auth/refresh` refusing is the signal the session is over

The API clears both cookies when it refuses a renewal, so the browser is already
in the right state. The renewal resolves to "not renewed", the original 401 is
returned to the caller, and the app's existing paths take it from there: the next
`whoAmI()` answers null and the router goes to sign-in.

### Not `/auth/refresh` itself, and not the sign-in call

A 401 from the renewal must not start another renewal, and a 401 from
`/auth/login` means a wrong password, not an aged-out session — renewing there
would turn a bad password into a spurious refresh attempt on every typo. Both are
excluded by path.

## Risks / Trade-offs

- **Two tabs open, both renewing** → Each has its own single-flight, so two
  genuinely concurrent renewals both go out. Driven by hand against a local API
  (10-second access lifetime, two tabs, both renewals scheduled to the same
  wall-clock instant), and it is worse than this section first claimed:

  - the winner is answered 200 and given fresh cookies;
  - the loser is answered 401 — and the API clears both cookies as it refuses;
  - the cookie jar is **shared between tabs**, so the loser's clearing headers
    wipe the fresh cookies the winner was just given.

  Both tabs end up signed out, not one. Measured, not reasoned: winner renewed
  200, then its very next request was 401 and it could not renew again.

  **Closed, in this change — but not by the lock alone.** The first attempt was
  a Web Lock and nothing else, on the reasoning that a serialised second renewal
  would present the fresh cookie, succeed, and cost only a redundant rotation
  this section called harmless. Measured again, that was wrong, and in an
  instructive way. The wire log of two tabs renewing under the lock:

  ```
  A /auth/me      -> 401
  A /auth/refresh -> 200     (revokes jti1, issues jti2)
  B /auth/refresh -> 200     (revokes jti2, issues jti3)
  A /auth/me      -> 401     (A's retry still carries jti2)
  ```

  Neither renewal was refused. The damage was the *redundant* one: access and
  refresh share a `jti`, and every rotation revokes the previous session, so B's
  unnecessary renewal invalidated the token A had just been given and was about
  to retry with. Taking turns moved the casualty; it did not remove one.

  What closes it is not renewing twice. Each tab notes a mark in `localStorage`
  when it renews; a tab that waited compares the mark against what it saw before
  queueing, and a change means another tab already renewed into the jar they
  share — so it renews nothing and simply retries. The lock is still needed: it
  is what makes "compare, then act" atomic between tabs.

  The same measurement afterwards:

  ```
  B /auth/me      -> 401
  A /auth/me      -> 401
  B /auth/refresh -> 200     one rotation, total
  B /auth/me      -> 200
  A /auth/me      -> 200     A never refreshed; it used B's cookies
  ```

  A browser with no Web Locks, or no storage to leave the mark in, falls back to
  the per-tab slot and the two-tab hole. That is the behaviour everything had
  before this change, so the fallback makes nothing worse.

- **A session now lives as long as the host keeps working** → Rotation issues a
  fresh 7-day refresh token each time, so an active host is never signed out.
  That is what a sliding session is, and it is what the 7-day refresh token was
  always for; the idle host still ages out. Worth stating plainly because it
  changes the practical meaning of the existing lifetimes: today they are
  effectively 15 minutes.

- **A renewal on the mount-time read costs a round trip before the first paint**
  → Only when the access token has actually aged out, and only one, against the
  alternative of a sign-in screen. The loading state the provider already shows
  covers it.

- **The retry replays the original request** → Safe for the reads that dominate,
  and safe for the writes here: the request was refused before it reached
  anything, so nothing was applied. Worth remembering if a future endpoint is
  ever made non-idempotent on a refused call.

## Migration Plan

None. No stored state, no schema, no API change, nothing to roll back but the
code itself. Hosts with a live session keep it; hosts already sitting on the
sign-in screen sign in as they do now.

## Open Questions

- Should a host whose session truly ended be told so on the sign-in screen,
  rather than silently arriving there? Out of scope here; worth its own change.
- None outstanding. The cross-tab question this section once left open was
  answered by measuring it, and closed in this change.
