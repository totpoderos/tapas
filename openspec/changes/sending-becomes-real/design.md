## Context

Five slices built the invitation's whole life on top of a mailer that keeps
messages in an array. That was right for them — none had a screen, and an
in-process test can read the array directly — but it means the step the entire
redesign depends on has never run.

Three things in the existing code decide most of this slice:

- **`InviteHost` awaits an unguarded send.** Its comment promises that a failed
  send leaves the invitation intact; the code lets the exception through, so a
  real transport turns a stored, live invitation into a 500 carrying neither
  the link nor the id needed to resend. `InMemoryMailer` never throws, so
  nothing has ever caught it.
- **The raw token exists in exactly one place.** `host-enrollment` requires the
  stored invitation not to reveal the link, and only the SHA-256 is written. At
  the moment a send fails, the token is alive only in the request unwinding
  around it.
- **Every slice since the invitation was built has ended with the same
  caveat**: the whole flow cannot be exercised outside the API process, because
  the link never leaves it. The smoke tests have all seeded a token hash.

## Goals / Non-Goals

**Goals:**

- One transport for everything outside the API process, so nothing ships that
  the tests never run.
- A failed handoff that is a reported outcome rather than an exception.
- An honest record of what happened, named for what is actually observable.
- A whole-system test that reads a real message.
- Production that refuses to start without the configuration this now depends on.

**Non-Goals:**

- Retries, queues, backoff. One attempt, an honest answer, and resend as the
  remedy — which already exists.
- Bounce handling. It needs an inbound endpoint and a public webhook, and it is
  the reason delivery cannot be claimed.
- Templating. One message, one link.
- Any screen. C2 and C3.
- Replacing the in-memory implementation. It stays, and it is the right thing
  for tests that live inside the process.

## Decisions

### Two implementations, never three

`InMemoryMailer` for tests inside the API process; SMTP for development, the
demo, CI and production.

The obvious alternative was a file-writing transport for the end-to-end run — no
service to start, and the message on disk before the response returns, so a test
never polls. It was tempting for exactly that determinism, and it is the wrong
shape: it would be a third implementation exercised **only by CI**, sitting
beside a fourth path exercised only by production. That is the asymmetry this
codebase keeps paying for — the assistant validating differently from MCP, the
cookie path carrying a role the token path did not. Paying a little polling
latency to avoid recreating it is a good trade.

### SMTP, with a dependency, rather than hand-rolled

This project hand-rolled its JWTs deliberately, as a curriculum choice. SMTP is
not the same trade: a much larger protocol, far less to learn from implementing
it, and TLS and authentication that would be a genuine security risk to get
subtly wrong. The dependency is the safer and smaller thing.

SMTP rather than a provider's HTTP API also keeps the deployment open to any
mail server, and — decisively — it is what makes the demo honest, because a
local catcher speaks SMTP. The demo and production then run the *same* code with
a different destination, rather than the demo standing in for something the
audience never sees.

### The link rides on the failure, and only there

Returned in the response that reports the failed handoff. Not stored, so never
listable.

The alternative is storing the raw token for failed invitations so the panel
could show it later, which breaks the invariant the whole design rests on: the
stored invitation must not be enough to accept with. If the administrator loses
the answer, the remedy is to resend — which mints a new token and kills the old
one, and already works.

This has a second life. Point development at a mail catcher that is not
running, and every invite fails its handoff and hands back the link — so a
developer who does not care about mail gets a working link, and one who does
starts the catcher. The failure path *is* the fallback, with no environment
branch to write.

### The record says handed off, not delivered

A mail server accepting a message is the last thing this system observes.
Delivery is decided afterwards by parties it never hears from, and bounces
arrive asynchronously at an address nothing here reads.

So the invitation records the handoff, and the word "delivered" appears nowhere.
This is not pedantry: C3 renders whatever this column says, and a screen telling
an administrator "delivered ✓" about a message that bounced would be worse than
a screen that says nothing.

### The catcher is started by the test runner, not by CI

Playwright's `webServer` already supervises the API and both frontends; the
catcher joins them. Local runs and CI then start it identically, and there is no
CI-only configuration that can drift from what a developer sees.

The alternative — a `services:` block in the workflow — is fewer moving parts in
CI and one more way for the two to differ. Given this slice exists partly
because an untested path was allowed to diverge, that is the wrong direction.

The cost is that the end-to-end run now needs the catcher available locally. The
project already requires Docker to deploy, so it is not a new class of
dependency, but it is new for the test loop and belongs in the README.

### Reading messages: reset first, then poll

A catcher accumulates, so a spec asking for "the latest message" can get one
from three specs ago. The suite runs single-worker and not in parallel, so
clearing before each spec is both safe and cheap.

Indexing is asynchronous — the SMTP transaction completes before the message is
searchable — so reading straight after the response can miss it. Polling with a
timeout, never a fixed sleep: a fixed wait is either flaky on a loaded runner or
slow on every run.

### Production will not start without mail configured

Mail is the only route to a host account. A deployment with no mail settings is
one where nobody can ever be invited, and it would surface as a failed invite
weeks after deploy rather than at boot.

`env.ts` already refuses to start on a missing signing key and on an
administrator address left at its committed default. Mail belongs in the same
check, with development defaults that point at a local catcher.

## Risks / Trade-offs

- **Nothing automated exercises production's mail server** → The transport is
  exercised end to end against a catcher, which proves the code path, the
  configuration shape and the message. What it cannot prove is that a
  particular relay accepts it. That gap is real and closes only on a first real
  deploy.
- **The end-to-end run gains a prerequisite** → Named above; documented rather
  than worked around, because the alternative was a transport only CI runs.
- **A live credential in a response body** → Deliberate, once, on a path only an
  administrator or a first-run claimant can reach, and never written down. The
  alternative is no link at all and resend as the only remedy — simpler, and
  meaningfully worse to use when mail is misconfigured, which is exactly when
  somebody needs it.
- **A first third-party dependency for a protocol** → Weighed against
  hand-rolling SMTP and its TLS and authentication. The supply-chain gate in CI
  covers it like any other.
- **Polling makes the end-to-end suite slower** → Bounded by a short timeout,
  and only on the specs that read a message.

## Migration Plan

One migration recording the handoff outcome on `host_invitations`, nullable so
existing rows are untouched — they were sent by a mailer that could not fail,
and claiming otherwise for them would be inventing history. Mail settings are
additive with development defaults, so nothing that runs today stops running.
Rollback is dropping the column and the transport; no data is rewritten.

## Open Questions

- Does an invitation whose handoff failed deserve a shorter life than 24 hours?
  Nobody received it, so the window protects nothing — but shortening it would
  make expiry depend on delivery, and the expiry rule is deliberately a
  question about the clock alone. Left as is; worth revisiting only if the
  panel makes stale failed invitations noisy.
