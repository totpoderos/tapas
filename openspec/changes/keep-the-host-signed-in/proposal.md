## Why

A host is put back on the sign-in screen about fifteen minutes after signing in,
however busy they were. Refreshing a session is already built and specified —
the API rotates a refresh token correctly, and the browser has been holding one,
good for seven days, the whole time. Nothing in either frontend ever spends it.

The cost is not only the interruption. A host who is halfway through configuring
a contest loses what they were doing, and the app cannot tell them why: nothing
maps an aged-out session to an explanation, so the work simply fails.

## What Changes

- The host app renews an aged-out session by itself and carries on, so a host
  stops being sent back to sign-in while they are working.
- The renewal happens where every request already passes, so it covers the read
  that decides who is signed in on a reload — the one that produces the bounce.
- Concurrent requests that all find the session aged out cause **one** renewal
  between them, not one each. This is a correctness requirement, not a
  performance one: the API revokes a refresh token as it spends it, so a second
  simultaneous renewal presents a token that has just been revoked and would end
  the session it was meant to save.
- A renewal that is genuinely refused — the seven days are up, or the session was
  signed out elsewhere — still lands the host on sign-in, as it does today.

Not in scope: the participant app, which has no access/refresh split at all (a
voter holds one long-lived token), and the access and refresh lifetimes
themselves, which are unchanged.

## Capabilities

### New Capabilities

None. The capability exists and is specified; this change is about the app
using it.

### Modified Capabilities

- `host-authentication`: adds a requirement that a host working in the app keeps
  working across an aged-out session without re-entering their password, and
  that simultaneous work causes a single renewal. The existing requirement that
  a session can be refreshed and a used-up refresh cannot be replayed is
  unchanged — this one says the app does it.

## Impact

- `packages/host-web/src/api/client.ts` — the shared request helper gains the
  renew-and-retry, and a module-level single-flight for it. Every existing
  caller is affected, and none of them changes.
- `packages/host-web/src/auth/session.tsx` — reads through that helper already;
  the mount-time check inherits the renewal, which is what stops the bounce.
- No API change. `POST /auth/refresh`, the token lifetimes, the cookie
  attributes and the session store are all untouched.
- No new dependency, no new stored state, and nothing new in JavaScript: the
  tokens stay in httpOnly cookies exactly as they are.
