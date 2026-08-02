## Context

The scannable code on the live-contest panel encodes the join code as plain text.
[scannable-code.tsx](packages/host-web/src/contests/scannable-code.tsx) says why, and
the reason is a missing wire rather than a decision:

> nothing tells this app the participant app's public address, so a scan gives the
> code, which the person then types

Both ends already exist. The participant app routes `/j/:code`
([app.tsx:22](packages/participant-web/src/app.tsx:22)) and
[join.tsx](packages/participant-web/src/pages/join.tsx:25) normalises the code's case
on arrival and looks its places up without being asked. The API holds the participant
app's public address in `PARTICIPANT_WEB_ORIGIN`
([env.ts:46](packages/api/src/config/env.ts:46)), set per deployment from
`PARTICIPANT_DOMAIN` and already used to build the CORS allowlist
([composition.ts:254](packages/api/src/composition.ts:254)).

The constraint that decides the shape of this: **the built host-web assets are
deployment-agnostic on purpose.** One image is pushed to GHCR and the domains are
supplied at `compose up` time, which is why `API_PROXY_TARGET` is a runtime setting
and the Dockerfile says so. Anything the host panel learns about a deployment has to
arrive at runtime.

## Goals / Non-Goals

**Goals:**

- A scan of the host's code lands on the participant app's joining screen with the
  code already entered.
- The address comes from the deployment's existing configuration — no new setting, no
  new deployment step.
- The panel keeps working for people who cannot scan: the code stays printed and
  copyable.
- The host panel does not learn the participant app's route shape or its address at
  build time.

**Non-Goals:**

- Making a dev-machine QR scannable from a phone. The participant address defaults to
  `http://localhost:5174`; a real scan against a dev box needs that set to the
  machine's address on the network, which is a `.env` edit, not code.
- Short links, redirects, or a link-shortening hop. The link is long enough to encode
  comfortably and a redirect would add a failure point at the venue.
- Putting the link anywhere the join code is not already reported (the contest list,
  the publish response, the assistant's answers).
- Changing the join code itself, how it is issued, or how long it lasts.

## Decisions

### The API reports the link; the host panel does not build it

The join link arrives from the API as a field beside the join code.

*Alternatives considered.* A build-time `VITE_PARTICIPANT_BASE_URL` in host-web is the
smallest diff, and it was rejected: it bakes a domain into an image that is
deliberately domain-free, so the same image could no longer serve two deployments and
a domain change would mean a rebuild rather than a restart. A public config read
(`GET /config` → `{ participantWebOrigin }`) keeps the route shape in the frontends,
but it adds a request and an endpoint to deliver one string, and leaves the panel
composing a URL whose shape belongs to the other app.

### The link is composed at the HTTP boundary, not in the domain

`toContestDto` ([contest-dto.ts:21](packages/api/src/contests/contest-dto.ts:21))
gains the participant address as an argument and emits `joinUrl` alongside the stored
contest's `joinCode`.

A join link is a deployment fact — the same contest read from two deployments has two
different links — so it is not an invariant of the Contest aggregate and has no
business in the `domain` workspace, which is I/O-free and knows nothing about
addresses. The DTO mapper is where stored facts already meet transport concerns; it
is where the `Map` flattening lives for the same reason.

`toContestDto` is the single seam every host-facing read of a whole contest passes
through — read by id, read by name, and the close and reveal responses. Composing
there means those four cannot disagree. (This is the parallel-path asymmetry that
keeps biting: two "equivalent" paths that diverge in one layer.)

### The participant address is its own dependency, not `security.allowedOrigins[1]`

The address is already in the deps as the second element of the CORS allowlist.
Reading it by position would couple the join link to the order of an unrelated array —
a reorder would silently point every QR at the host panel. It is threaded as its own
named dep instead, from the same `env` value.

### The API owns the `/j/<code>` shape, in one named place

Composing the link server-side means the API knows one participant-app route. That is
the cost of the decision above, and it is paid once: the shape lives in a single
named function so there is one place to change if the deep link ever moves. It is
already public contract in every sense that matters — it is what a shared link is.

The address is normalised for a trailing slash before joining, so
`https://join.example.com/` and `https://join.example.com` produce the same link
rather than one with `//j/`.

### `ScannableCode` is told what to encode and what to call it, separately

The component takes the value to encode and, separately, the join code that names it
for a screen reader. It does not derive one from the other, so it never parses a URL
and never learns the route shape either.

This is what keeps the accessible name saying "Scannable code for join code 4KQ-207"
rather than reading an address out character by character — which is both useless to
listen to and what the existing a11y and Spanish e2e checks assert.

Its doc comment currently explains at length why it encodes the code and nothing
else, and its unit test is named "encodes the join code, and nothing else". Both are
the old decision written down; both are rewritten rather than patched, and the test
keeps recomputing the module grid independently rather than snapshotting — so it
still fails if the component ever encodes something other than what it was given.

### A missing link is a failure, not a fallback

`joinUrl` is required on the contest the panel reads, not optional. The API and the
panel ship in the same release from the same repo, so a missing field means a broken
deployment. Falling back to encoding the bare code would hide that behind a QR that
merely does less than it should — the failure would reach the venue instead of the
build.

## Risks / Trade-offs

**The symbol gets denser.** ~36 characters against 7 takes it from roughly 21×21
modules to 29×29 at error-correction level M. → Level stays M (a venue print gets
smudged and thumbed; dropping to L to save modules trades the wrong thing). The
existing 200%-zoom check on a 375px viewport asserts the rendered code stays square,
over 100px and inside the viewport, and must keep passing at the new density —
verified rather than assumed, since it is sized in `em` and the module count changed.

**A misconfigured participant address sends the whole room somewhere wrong.** A QR
that resolves to nothing is worse than one that resolves to a code you type. → The
address is already load-bearing for CORS, so a wrong one breaks the participant app
long before anyone scans anything; this adds no new way to get it wrong. Trailing
slashes are normalised.

**Locally, the QR points at `localhost:5174` and a phone cannot follow it.** → Named
in the proposal and the change's docs, not solved. Local verification uses the
browser, and the printed code still works by hand.

**A join code now travels in a URL path.** The project's own rule says secrets never
go in URLs. → A join code is not a secret: it is meant to be held up to a room, it is
already a path segment on the participant app's deep link and on the places lookup,
and it grants only the ability to claim an unclaimed place. Nothing else about the
contest joins it in the link. Called out so a security review meets it deliberately
rather than by surprise.

## Migration Plan

Additive and backward-compatible in both directions that matter: the join code keeps
being reported and keeps working when typed, so a participant who ignores the QR
entirely sees no change, and a link already shared keeps resolving.

No data migration, no new environment variable, no deployment step. Rolling back is
reverting the change — the join code is still what the contest is joined by.

## Open Questions

- Should the host assistant offer the link in chat when a host asks how people join?
  It reports the code today and its details shape does not carry the join code at all,
  so nothing is inconsistent by leaving it. Deferred rather than decided.
- Should the printed code beside the QR become a link a host can hand over from a
  laptop (mail, chat) rather than only text to copy? A natural follow-up, out of scope
  here: this change is about what the scan does.
