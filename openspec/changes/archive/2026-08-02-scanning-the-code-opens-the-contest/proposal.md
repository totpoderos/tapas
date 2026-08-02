## Why

Scanning the code a host holds up today gets you a piece of text. You still have to
find the participant app yourself, then type the code you just scanned into it — so
the scan saved nothing, and the host still reads the address out to the room.

The app already has both halves of the answer: the participant app answers on
`/j/<code>` and joins straight from it, and the API already knows the participant
app's public address, because it keeps it to decide who may call it. Nothing new
has to be learned; the two halves have to be introduced to each other.

## What Changes

- A published contest reports a **join link** as well as its join code — the address
  that opens the participant app already carrying that code.
- The scannable code on the live-contest panel carries that link instead of the bare
  code. Scanning it opens the participant app on the joining screen, code filled in.
- The join code stays printed beside the scannable code, and copying it stays on
  offer. A scan can fail, a phone may have no camera, and someone may be joining from
  a laptop across the table.
- The scannable code keeps naming its join code when read aloud by a screen reader.
  What a person needs to hear is which code this is, not a URL read out character by
  character.
- No new deployment setting. The join link is built from the participant address the
  deployment already configures.

Not breaking: the join code keeps its meaning, keeps being reported, and keeps
working when typed. This adds a second way in, and takes none away.

## Capabilities

### New Capabilities

None. This changes what two existing capabilities report and show.

### Modified Capabilities

- `contest-management-api`: what a live contest reports gains a join link — the
  address that opens the participant app carrying the contest's join code. A contest
  still being prepared reports none, exactly as it reports no join code.
- `manage-live-contest`: the scannable code's requirement currently says it carries
  the join code "and nothing else about the contest". It carries the join link now,
  so that requirement has to say what the link may contain, and go on forbidding
  everything else about the contest.

## Impact

**API.** The contest a host reads (`GET /contests/:id`) gains a join link beside its
join code, built from the participant address in the environment
([env.ts:46](packages/api/src/config/env.ts:46), already set per deployment from
`PARTICIPANT_DOMAIN` in [docker-compose.prod.yml](docker-compose.prod.yml)). The
publish responses ([draft-routes.ts:163](packages/api/src/http/draft-routes.ts:163)
and [:368](packages/api/src/http/draft-routes.ts:368)) and the contest list are
deliberately **left alone** — the panel that shows the scannable code is the only
thing that needs the link, and reporting it in places nothing reads would be
speculation.

**Host panel.** [scannable-code.tsx](packages/host-web/src/contests/scannable-code.tsx)
takes the link to encode rather than deriving it, so it never learns the participant
app's route shape. Its documented rationale — "It encodes the join code text and
nothing else… nothing tells this app the participant app's public address" — is now
wrong on both counts and is rewritten. Its unit test asserts the same thing by name
("encodes the join code, and nothing else") and is rewritten with it.
[client.ts](packages/host-web/src/api/client.ts:515) grows the field on
`ContestDetail`.

**Participant app.** Unchanged. `/j/:code` already routes
([app.tsx:22](packages/participant-web/src/app.tsx:22)) and already folds the code's
case on arrival ([join.tsx:25](packages/participant-web/src/pages/join.tsx:25)).

**The code gets denser.** A link is around 36 characters against the code's 7, so the
symbol grows from roughly 21×21 modules to 29×29. It is sized in `em` and there is an
existing check that it survives 200% zoom on a narrow screen, which has to keep
passing at the new density.

**Security.** The link carries the participant app's public address and the join
code — the code that was already in the scannable code, and an address that is public
by definition. Nothing about the contest, its host or its participants joins it. Note
for review: the join code travels in a URL path here, which the project's own rule
forbids for secrets. A join code is not one — it is a handle meant to be shown to a
room, it is already a path segment on the participant app's own deep link and on the
places lookup, and it admits you only to choosing an unclaimed place.

**Local development.** The participant address defaults to `http://localhost:5174`,
so a code scanned with a real phone against a dev machine will not resolve. That is
what the default means and this change does not try to fix it; a developer wanting a
real scan sets the address to their machine on the network.
