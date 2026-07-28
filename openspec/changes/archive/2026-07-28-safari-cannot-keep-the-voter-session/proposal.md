## Why

A participant using Safari can join a contest and then do nothing else. They pick their place, the screen welcomes them by name, they type in the dish they brought — and saving it fails with "Your dish couldn't be saved. Please try again." Trying again fails the same way, because nothing about it is temporary.

The cause is that their session was never kept. The voter's session cookie is marked as requiring a secure connection, unconditionally, and Safari refuses to keep such a cookie when the site is served over plain HTTP — which is how the app is served in development. Chrome makes an exception for local addresses; Safari makes none. The join *looks* successful because the app remembers who the participant is on the device itself, quite separately from the session, so the screen moves on while every request that needs the session is refused from that moment.

It has gone unnoticed because every automated browser test runs in Chromium — the one browser whose exception hides it. The participant app is the mobile-first one, used at a venue on whatever phone people brought, and on iOS **every** browser is Safari underneath. So this is not an edge case in the audience it matters most for.

## What Changes

- **A voter's session survives in Safari.** The session cookie's transport requirement matches how the site is actually being served, rather than being asserted unconditionally: still required over HTTPS, not demanded when the app is served over plain HTTP in development.
- **The same holds for a host's session**, which is set with identical flags and has the identical problem — a host signing in through Safari locally cannot do anything either.
- **A session that cannot be kept is not reported as a save that failed.** A participant whose session is missing is told they are no longer signed in and sent back to join, instead of being shown a "try again" that can never succeed.
- **The browsers are no longer assumed to behave alike.** The whole-system tests cover the participant's journey in a WebKit browser as well as Chromium, so a difference between them fails the build rather than reaching a phone.
- **BREAKING for nobody:** production behaviour is unchanged — over HTTPS the cookie is exactly as strict as it is today. Only the local, plain-HTTP case relaxes, and it fails closed if the environment is unknown.

## Capabilities

### New Capabilities

None. This is a defect, not a feature: what should happen is already the point of `enroll-participants`, it simply does not hold in one browser.

### Modified Capabilities

- `enroll-participants`: gains requirements stating what was previously left implicit — that a claimed place keeps the participant signed in **in whatever browser they are holding**, and that a session which was never kept is reported as being signed out rather than as a failed save. Added rather than rewritten: the existing requirements are all still true, they were just silent about the browser.

## Impact

- **API** — how the session cookies are marked. One place sets them for hosts and voters alike, and it is the only thing that has to change for the defect itself.
- **Participant app** — telling apart "we could not save this" from "you are not signed in", on the screens a joined participant uses.
- **Whole-system tests** — a second browser in the matrix. This is the part that stops it happening again, and the part that will take the most time to land, since it means every existing scenario has to hold in WebKit too.
- **Not the security posture** — over HTTPS nothing changes. The relaxation is scoped to a non-production environment and defaults to the strict setting when the environment is not explicitly a development one, so a misconfiguration cannot quietly weaken a deployed site. This is worth recording in `docs/threat-model.md` beside the existing transport notes.
