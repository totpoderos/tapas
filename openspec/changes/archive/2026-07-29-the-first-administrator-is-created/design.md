## Context

Four slices have built an enrollment surface that nothing can reach. The role
is enforced, invitations have a complete life, and no code path in a running
deployment produces an administrator — `HostAccount.register()` hardcodes
`'host'`, and the only administrators that have ever existed were promoted by a
test helper.

The shape of this slice was settled in the explore discussion that preceded the
whole redesign, and one conclusion from it drives everything below: **the email
round-trip does not secure a bootstrap.** In ordinary enrollment the trust comes
from an administrator choosing the address; the click only proves the claimant
holds the inbox they typed. At first run nobody has chosen, so a claimant types
their own, and an attacker owns their own inbox exactly as well as the operator
owns theirs.

## Goals / Non-Goals

**Goals:**

- A deployment that can be claimed by exactly one address, decided out of band.
- A claim that cannot be stranded by a lost message.
- At most one administrator, guaranteed by the database rather than by a check
  that could race.
- An ordinary invitation that still cannot produce an administrator, whatever
  the code asks for.

**Non-Goals:**

- The first-run screen. It belongs with the other screens; this slice answers
  the question that screen will ask.
- More than one administrator, or administrators inviting administrators. One
  is what the redesign decided, and this slice makes it structural.
- Removing open registration. That is the last slice, and it depends on this
  one working.
- Transferring or replacing an administrator. Nothing here can hand the role to
  somebody else; that is a separate problem with its own recovery questions.

## Decisions

### The address is pinned in configuration, not typed by whoever arrives

`ADMIN_BOOTSTRAP_EMAIL` joins `env.ts` with the treatment `JWT_SECRET` and
`ASSISTANT_CONFIRMATION_SECRET` already get: a committed development default
that keeps local work frictionless, and a production `superRefine` that refuses
to boot while that default is still in place.

The alternative considered and rejected was a one-time setup token printed to
the server log. It binds the claim to "controls the server" rather than
"controls the config", which on this deployment is the same person — the API
will not boot without `JWT_SECRET`, so whoever started the stack already wrote
the environment. And it would mean writing a secret to stdout, against this
project's own stated rule that secrets are never logged. The distinction it buys
does not exist here; the rule it breaks does.

The exposure window this closes is not theoretical: `docker-compose.prod.yml`
fronts the stack with Caddy doing ACME on a public domain, so the deployment
resolves and serves TLS from the moment it is up — before the operator opens a
browser.

### Claiming again resends rather than being refused

While a claim is outstanding, offering the configured address again ends the
previous invitation and sends a fresh one.

Refusing instead would be tidier, and would leave a deployment unclaimable for
a full day whenever a message went astray — with no remedy, because the resend
built in the previous slice requires an administrator, and the whole problem is
that there is not one yet.

The cost is that somebody who knows the operator's address and reaches the URL
can cause repeated messages to that operator's inbox and invalidate links the
operator has not used yet. The ceiling on that is low: every message goes to one
inbox that the attacker does not control, the operator simply uses the most
recent link, and the route carries the sensitive rate limit. Being unable to
claim your own deployment for a day is the worse failure.

### At most one administrator, enforced by the database

A unique partial index on the administrator role. Two simultaneous claims then
produce one administrator and one failed write, rather than depending on a
read-then-write that a second request can interleave with.

This encodes the redesign's "one administrator" decision as a constraint rather
than a convention. If a later change wants several, dropping the index is the
deliberate act that allows it — which is the right way round.

### An account's role comes from its invitation

The invitation gains the role it was issued for. `RegisterHost` takes a role,
defaulting to `'host'`, and `AcceptInvitation` passes whatever the invitation
carries.

**This is the decision most worth challenging**, because it widens the one use
case that creates accounts into something that can create an administrator. The
alternative — a separate factory or a promote-after-create step — keeps
`RegisterHost` incapable of it, at the cost of two writes or a parallel path
through account creation, and this codebase's recurring bug is parallel paths
that drift.

Three guards make the widening safe, and no single one of them is trusted
alone: only the setup route can issue an invitation for the administrator role;
that route requires both the configured address and the absence of any
administrator; and the unique index makes a second administrator impossible
even if both of those were wrong. The spec also pins that an ordinary
invitation, resent or not, yields an ordinary host.

### The deployment says plainly whether it is unclaimed

An anonymous route answers whether an administrator exists, because the
first-run screen must know whether to offer itself.

This reveals that a deployment is unclaimed, which is worth naming rather than
glossing: it tells a stranger the instance is worth trying. It grants them
nothing — they still cannot pass the address gate — and they would learn the
same by attempting a claim. Hiding it would buy no security and would leave the
screen unable to decide what to render.

### A refused claim never says what the configured address is

The refusal says only that the claim failed. Echoing the expected address, or
saying "that is not the configured one", would turn an anonymous route into a
way to read part of the deployment's configuration. The security log records the
attempt; the caller learns nothing.

## Risks / Trade-offs

- **Someone claims the deployment before the operator does** → Only if they
  know and submit the configured address, which is the whole point of pinning
  it. If they do know it, the invitation still lands in the operator's inbox,
  not theirs.
- **The operator sets the wrong address in configuration** → They cannot claim
  the deployment, and the fix is to correct the environment and restart. A wrong
  but valid address means messages go somewhere unintended, which is why the
  refusal to boot on the development default matters more than validation alone.
- **A widened `RegisterHost`** → Named above as the decision most worth
  challenging, guarded three ways, and pinned by spec scenarios that an ordinary
  invitation never produces an administrator.
- **No way to replace a lost administrator** → If the only administrator's
  credentials are lost, nothing in this system recovers them; the door is
  closed and the setup route will not reopen. That is a real operational gap,
  deliberately out of scope, and the honest remedy today is database access.
  Worth recording rather than discovering.
- **The first-run screen is absent until the panel slice** → A deployment is
  claimed with a single request until then. For a single operator on first
  deploy that is not a hardship, and it keeps this slice on the API where the
  rest of the series has been.

## Migration Plan

One migration adding the invited role to `host_invitations`, defaulting to
`'host'` so existing rows are unchanged, and a unique partial index on the
administrator role in `host_accounts`. The index is safe to add to any existing
database: no deployment has ever held an administrator, so it cannot conflict.
Rollback is dropping both and the new routes.

## Open Questions

None. The pin, the resend behavior, the uniqueness guarantee and the role's
route through the invitation are all settled above; the screen is deliberately
deferred rather than undecided.
