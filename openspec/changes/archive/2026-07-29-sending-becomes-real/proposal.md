## Why

Nothing in this system has ever sent anything. The mailer has one
implementation and it keeps messages in an array, which was the right call for
the slices that built the invitation's life — but it means the entire
enrollment redesign rests on a step that has never been exercised.

It also hides a bug. `InviteHost` carries this comment:

> Stored first, then sent: a send that fails leaves an invitation that exists
> rather than one that was lost.

The code does not do that. The send is awaited with no guard, so a transport
that throws propagates: the administrator gets a 500, the invitation is stored
and live, and nothing tells them — no link, and not even the id they would need
to resend it. `InMemoryMailer` never throws, so this has been latent since the
invitation was built. A real transport is what activates it.

And there is a third thing only a real transport makes answerable: whether a
message went out at all. The admin panel needs to show that, and it cannot
until something records it.

## What Changes

- A real SMTP transport joins the port. **Two implementations, not three** —
  the in-memory one for tests that run inside the API process, and SMTP for
  everything that leaves it: development, the demo, CI, and production. A
  transport exercised only by the test suite, sitting beside a different one
  exercised only by production, is the shape this codebase has been bitten by
  before.
- A failed handoff stops being a 500. The invitation was stored; the response
  says so, names it, and reports that the message did not go out.
- The invitation records whether its message was handed off — **never that it
  was delivered.** A mailer learns that a relay accepted a message, nothing
  more; bounces arrive later, asynchronously, and nothing here consumes them. A
  field named for delivery would make the admin panel claim something it cannot
  know.
- When handoff fails, the response carries the link. Once, in that response,
  and nowhere else: the raw token exists only in the request that created it,
  and keeping it so the panel could show it later would break the rule that the
  database holds a hash and nothing more.
- Production refuses to start without mail configured. Mail is now the only
  route to a host account, so an unconfigured deployment is one where nobody can
  ever be invited — a failure that would otherwise surface as a 500 weeks later.
- The whole-system test finally reads a real message instead of reaching into
  the database. Every slice since the invitation was built has had to seed a
  token hash because the link existed only inside the API process; that ends
  here.

## Capabilities

### Modified Capabilities

- `host-enrollment`: inviting gains an outcome. The requirement that the invited
  person is sent a link becomes one that also says what happens when they are
  not — the invitation stands, the administrator is told, and the link is
  offered once.
- `admin-bootstrap`: claiming a deployment gains the same treatment, since a
  first-run claim that cannot reach its inbox would otherwise strand the
  deployment with no way to see what went wrong.
- `security-event-logging`: a message that could not be handed off is recorded.

## Impact

- `packages/api/src/mail/` — a second implementation behind the existing
  one-method port, and the first third-party dependency this project takes for
  a protocol it will not hand-roll.
- `packages/api/src/auth/use-cases/invite-host.ts` — the send becomes guarded,
  and its result becomes part of what inviting returns. `resend-invitation.ts`
  and `claim-deployment.ts` both go through it and inherit the change.
- Migration recording the handoff outcome on the invitation.
- `packages/api/src/config/env.ts` — mail settings, with the same
  refuse-to-boot-in-production treatment the secrets and the administrator
  address already get.
- `docker-compose.yml` and `playwright.config.ts` — a mail catcher for the demo
  and for the end-to-end run, started the same way locally and in CI so the two
  cannot drift.
- `.github/workflows/ci.yml` — nothing, if Playwright starts the catcher
  itself; the point of doing it there rather than in a `services:` block.
- **No screens.** The invited person's screens are C2 and the administrator's
  panel is C3. This slice is what makes both of them worth building.
