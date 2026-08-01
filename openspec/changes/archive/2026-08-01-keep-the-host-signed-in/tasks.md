## 1. The failing tests

- [x] 1.1 Write `packages/host-web/tests/unit/api/renew-session.test.ts` covering
      the request helper: a refused call renews and is carried out, and its
      result is what the caller gets.
- [x] 1.2 Add the overlap test: two calls raised together against an aged-out
      session cause exactly one renewal, and both are carried out. Assert the
      renewal call count — this is the test that would catch a lost single-flight,
      and nothing else would.
- [x] 1.3 Add the bounded-retry test: a call refused again after a renewal is
      reported to the caller, and renews no second time.
- [x] 1.4 Add the dead-session test: a refused renewal leaves the original
      refusal standing for the caller.
- [x] 1.5 Add the excluded-paths tests: a refused sign-in does not renew, and a
      refused renewal does not renew.
- [x] 1.6 Extend the session tests so the mount-time read is covered — an
      aged-out session that renews leaves the host authenticated, with their
      role read, and not sent to sign-in.
- [x] 1.7 Run them and watch each fail for the stated reason, not for a missing
      import.

## 2. The change

- [x] 2.1 Add `renewSession()` to the client: posts to `/auth/refresh`, resolves
      true or false, never throws.
- [x] 2.2 Add the module-level single-flight around it — one promise slot,
      cleared when it settles, shared by every caller that arrives while it is in
      flight.
- [x] 2.3 Teach `send()` to renew and replay once on a 401, carrying the
      already-retried flag, with `/auth/login` and `/auth/refresh` excluded.
- [x] 2.4 Get the tests from group 1 green without touching them.

## 3. Verification

- [x] 3.1 Full `npx vitest run`, then `npm run typecheck` and `npm run lint`.
- [x] 3.2 `openspec validate keep-the-host-signed-in --strict`.
- [x] 3.3 Look at it by hand: sign in against a local API, shorten the access
      lifetime so the wait is seconds rather than fifteen minutes, then work and
      reload past the expiry and confirm the app never reaches sign-in. Restore
      the lifetime afterwards and confirm it is not in the diff.
- [x] 3.4 Confirm the two-tab hole from the design is still just that — one tab
      renewing does not sign the other out mid-request — and record what actually
      happens, whether or not it is what the design predicted.
      **Found worse than predicted**: the loser's refusal clears the shared
      cookie jar, so *both* tabs are signed out, not one. Recorded in design.md;
      not a regression (both tabs die at fifteen minutes today) but the risk as
      first written was wrong.

## 5. Closing the two-tab hole

- [x] 5.1 Write the failing test: the renewal is taken *inside* a browser-wide
      lock, not merely near it — assert the ordering, since a test that only
      checks the lock was asked for would pass on a lock that wraps nothing.
- [x] 5.2 Write the fallback test: a browser offering no such lock still renews,
      on the per-tab slot it had before.
- [x] 5.3 Take the renewal under `navigator.locks`, keeping the module-level
      slot underneath it for the single-tab case and for browsers without it.
- [x] 5.4 Record the requirement in the delta spec, and turn the design's risk
      from a known hole into what was measured and what closed it.
- [x] 5.5 Re-verify by hand: two tabs, both renewals scheduled to the same
      wall-clock instant, and confirm both survive where both died before.
      **The lock alone did not fix it** — measured, not assumed. Both renewals
      were answered 200 and the *redundant* one revoked the token the other tab
      was retrying with, so a tab still lost its session.
- [x] 5.6 Add the shared mark so a tab that waited renews nothing, and the test
      that fails without it (asserts zero renewals, not just a working call).
- [x] 5.7 Re-measure: one rotation total across both tabs, both still signed in.

## 4. Landing it

- [x] 4.1 Branch, commit, PR.
- [x] 4.2 Once merged: sync the delta into `openspec/specs/host-authentication`
      and archive the change.
- [x] 4.3 Raise the follow-ups the design leaves open. Only one survived: the
      other, cross-tab coordination, was pulled into this change once measuring
      showed two windows lost the session outright. What is left is telling a
      host whose session truly ended why they are being asked to sign in —
      raised as its own piece of work, since it is a screen with words in two
      languages.
