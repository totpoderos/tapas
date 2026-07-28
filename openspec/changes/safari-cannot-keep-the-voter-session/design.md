## Context

A participant on Safari joins a contest, is welcomed by name, types in their dish, and is told *"Your dish couldn't be saved. Please try again."* Retrying never works.

The chain, from the code:

```
setVoterCookie()          secure: true, sameSite: 'none'   — unconditional
  session-cookies.ts:40

Safari                    refuses to store a Secure cookie from an http:// origin.
                          Chrome has an explicit localhost exception. Safari has none.

join.tsx:92               localStorage.setItem(REMEMBERED_CONTEST, …)
                          setStep({ name: 'joined', identity })
                          — the app's idea of "joined" does not depend on the cookie

your-dish.tsx:59          submitDish() → 401 → catch → t('yourDish.errorSave')
                          "Your dish couldn't be saved. Please try again."
```

So the claim succeeds server-side, Safari silently drops the cookie, and the app moves to the joined screen because it tracks identity separately. Every authenticated request from then on is refused, and the app reports the refusal as a failed save.

Three facts make this worse than a normal dev-environment quirk:

- **The participant app is the mobile-first one**, used at a venue on whatever phone people brought. On iOS every browser is Safari underneath, so this is the primary audience.
- **`playwright.config.ts:40` runs `chromium` only.** 87 end-to-end tests, one engine — the one whose exception hides the bug.
- **The host app has the same defect**, since `setSessionCookies` is set with the same flags. A host signing in through Safari locally is equally stuck; it simply has not been reported.

`Env` already distinguishes environments (`NODE_ENV: 'development' | 'production' | 'test'`, `config/env.ts:23`), so the information needed to fix this is already validated at startup.

## Goals / Non-Goals

**Goals:**

- A participant can complete the whole journey in Safari.
- Production transport security is exactly as strict after this change as before.
- A session that cannot be kept is reported as being signed out, not as a save that failed.
- The build fails if the two browsers diverge again.

**Non-Goals:**

- No move to HTTPS in development. It would also fix the cookie, but it means certificate handling in every contributor's setup and in CI, to solve a problem that a correct flag solves.
- No change to how sessions are issued, how long they last, or what they contain.
- No support for browsers outside the current target set, and no IE-era compatibility work.
- Not a fix for Safari's ITP blocking third-party cookies on a deployed site. That would be a different cause with a different fix; the app is served same-origin through a proxy precisely to avoid it.

## Decisions

### The cookie's transport requirement follows the environment, and fails closed

`secure` becomes `env.NODE_ENV !== 'development'` rather than `true`. `sameSite` follows it: `'none'` requires `Secure` to be honoured at all, so where `Secure` is off, `sameSite` becomes `'lax'` — which is correct for development anyway, because the dev server proxies the API under the app's own origin (`participant-web/vite.config.ts`), making the cookie first-party.

```
   production / test        development
   ──────────────────       ─────────────────────
   secure:   true           secure:   false
   sameSite: 'none'         sameSite: 'lax'
   (cross-site, HTTPS)      (same-origin via the dev proxy, http)
```

The condition is deliberately `!== 'development'` rather than `=== 'production'`. An unset, misspelt or unfamiliar environment must land on the strict setting; the only way to weaken the cookie is to say `development` explicitly. `env.ts` validates `NODE_ENV` against a closed enum at startup, so an unrecognised value fails fast rather than reaching this decision at all.

Rejected alternatives:

- **Serve development over HTTPS.** Fixes the symptom, but pushes certificate setup onto every contributor and into CI to work around a flag that should not have been unconditional.
- **Drop `SameSite=None` everywhere and rely on the same-origin proxy.** Tempting, since both apps are proxied. But the proxy is a development and preview convenience; the deployed topology is two frontends and an API, and quietly assuming same-origin would break the moment they are served apart.
- **Special-case `localhost` in the API.** Reproduces Chrome's exception by hand, in our own code, keyed on a hostname — more magic and less honest than reading the environment we already validate.

### The apps tell "signed out" apart from "it failed"

`ApiError` already carries the status, so a `401` is distinguishable from anything else at the call site. The participant screens gain that branch: refused-because-signed-out sends the participant back to joining with an explanation; everything else keeps the existing "could not be saved" message.

This is worth doing even though the cookie fix removes the common cause. A voter session expires (it is a remember-me token with a finite life), and a participant whose session has simply run out deserves the same clear answer rather than a retry that cannot work.

### WebKit joins the test matrix

`playwright.config.ts` gains a `webkit` project. This is the part that stops the class of bug rather than this instance of it — a cookie flag is one line, but "we only ever tested one engine" is why nobody knew.

The honest cost: every existing scenario must then hold in WebKit, and some will not on the first run for reasons unrelated to this defect (timing, focus behaviour, and input quirks differ). Those are real findings about a browser the audience actually uses, but they are discovered work, and this change should expect to absorb some of it.

If the whole matrix proves too slow or too noisy to gate on immediately, the fallback is to run WebKit over the participant journey only — the mobile-first app, where it matters most — and widen later. That is a smaller promise, and it is better than a `webkit` project that gets skipped.

## Risks / Trade-offs

- **A relaxed cookie escaping to production.** This is the one that matters, because the failure is silent and security-relevant. → The condition fails closed (`!== 'development'`), `NODE_ENV` is validated against a closed enum at startup, and a test asserts the flags for each environment — including that an unrecognised one stays strict. Record the reasoning in `docs/threat-model.md` next to the existing transport notes, so the next reader does not "tidy" it back to `true` or loosen it further.

- **WebKit turns the suite red for unrelated reasons.** → Expected, and it is information rather than noise: those are real differences in a browser the audience uses. Land the cookie fix and its regression test first so the defect is closed, then add the browser. Keep the narrower participant-only fallback in reserve rather than disabling the project.

- **CI time roughly doubles for E2E.** 87 scenarios against a second engine. → Acceptable for a mobile-first product whose users are overwhelmingly on iOS. If it becomes the bottleneck, the participant-only matrix is the lever.

- **The fix cannot be proven by the tests that missed it.** A Chromium-only suite would pass with the bug still present, because Chromium was never affected. → The regression test that actually counts is at the unit level: assert the cookie attributes per environment. That fails without the fix in any browser, and does not depend on the E2E matrix landing.

- **The app looks joined when it is not.** The deeper design smell is that "joined" is tracked in `localStorage` independently of the session. → Out of scope to restructure, but the second requirement narrows the damage: the participant is told they are signed out rather than being left to retry.

## Migration Plan

No schema change, no data migration, no API contract change. A cookie attribute becomes conditional, two participant screens gain an error branch, and the test matrix grows.

Deployed behaviour is unchanged: with `NODE_ENV=production` the cookies are byte-identical to today's. Rollback is reverting the condition to `true`, which restores exactly the current behaviour including the defect.

Order matters: land the cookie fix with its unit-level regression test first, so the defect is closed independently of how long the WebKit matrix takes to settle.

## Open Questions

- Whether the host app should also send a signed-out participant somewhere useful, or whether that is out of scope here. The host's sign-in flow already handles a lost session; this change fixes the host cookie but does not touch that flow.
- ~~Whether `test` should follow `production` or `development`.~~ **Answered by running it.** `test` keeps the strict flags, and the whole-system stack now declares itself `development` instead — which is what it literally is: two Vite servers and the API, all over plain HTTP on localhost. Keeping it as `test` made the E2E environment reproduce the defect, and WebKit failed 21 of 29 participant scenarios showing the new "You're no longer signed in" screen. That was the fix working, and the label being wrong. Only two things read `NODE_ENV` (this transport and the production-only HTTPS redirect), so the relabel changes nothing else.
- ~~Whether the WebKit matrix should gate from day one.~~ **Gating, and it cost nothing.** Once the environment was labelled honestly, all 29 participant scenarios passed in WebKit first time — the 21 failures were this defect, not browser drift. The predicted "unrelated WebKit differences" did not materialise.

- **Settled after the fact, and worth carrying forward:** WebKit-through-Playwright is not Safari. It found the cookie defect but could never have found the HSTS one (PR #95), because Playwright starts every run with a fresh profile and no HSTS state, and that defect is made entirely of persistent browser state. A real-device or real-browser check remains irreplaceable for anything involving state the browser keeps between visits.

- Still open: whether to widen WebKit past the participant journey to the host app. The participant app is where it matters (mobile-first, iOS is all WebKit) and the matrix is scoped there deliberately, but the host cookie had the identical defect and nothing browser-level guards it.
