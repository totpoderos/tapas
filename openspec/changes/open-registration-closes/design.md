## Context

The endpoint being removed is about fifteen lines. Forty-three files depend on
it, and almost all of them are tests that need a host to exist before they can
be about anything else — every participant journey included, because somebody
has to create the contest before anyone can score a dish.

So the work is not the deletion. It is answering, once, how a test comes to have
a host when nobody can register.

Two things already in the tree decide the answer:

- **The administrator role has been seeded since it existed.**
  `promoteToAdministrator` writes to the database in test support, precisely
  because nothing in the application assigned that role. The same move is
  available for hosts, and for the same reason.
- **The end-to-end setup project already runs the whole enrollment chain.** It
  claims the deployment, reads the message, accepts, and leaves an administrator
  signed in — before any other project starts.

## Goals / Non-Goals

**Goals:**

- No way for anybody to create an account for themselves.
- A test suite that says plainly how its hosts came to exist, at each level.
- Account-creation rules kept where they are, with only the door removed.
- A threat model and an accessibility record that describe what is actually
  true afterwards.

**Non-Goals:**

- Changing how invitations work. Eight slices settled that.
- Removing a host, or transferring an administrator. Never in this redesign,
  and G10 says what that costs.
- Scoring the three new screens with Lighthouse. It needs a browser; the gap is
  recorded rather than closed.

## Decisions

### The use case stays; only the route goes

`RegisterHost` validates the address, enforces the password policy, refuses a
taken address and stores a bcrypt hash. `AcceptInvitation` has called it since
invitations existed.

Deleting the route and keeping the use case is the whole point of that slice's
decision to reuse it rather than restate it: the rules never belonged to the
open door, and removing the door leaves them exactly where they were. Its unit
tests stay too — they test the rules, not the route.

### API acceptance specs seed their host

Twenty-two specs begin "given a signed-in host" and reach for HTTP registration
to get one. After this slice they seed the row, the way the administrator role
already is.

The alternative is running the real invitation flow in each of them, and it is
worse than slow: a tally spec would then fail when invitation expiry breaks, and
the spec that actually tests expiry would be one red line among forty.

There is also a plainer argument. *How* a host came to exist is not what a
reveal spec is about. Registering over HTTP was those specs asserting a
mechanism they never cared about; seeding says "this is a fixture" and stops
pretending otherwise.

### End-to-end specs invite one for real, through a single helper

Seventeen files, one helper, hosts created the way the system actually creates
them. Every one of those files then depends on enrollment working.

That is acceptable here and would not have been before C3. The setup project
already exercises claim, invite, message, accept, and it runs first — so a
broken enrollment fails *there*, loudly and in one place, before it can fail
confusingly in seventeen others. Ordering buys the diagnostic locality that
avoiding the dependency would have bought.

The alternative considered was a fixture list of seventeen named hosts built
once in the setup project. It concentrates the cost, and it drifts: a list of
names in one file, consumed by seventeen others, with nothing to keep them
honest when a spec is renamed or removed.

### The removal is stated as a requirement, not left as an absence

A spec that simply stops mentioning registration reads the same as a spec that
forgot about it. `host-authentication` gains a requirement that there is no way
to create an account for oneself, so that a future route reinstating it fails
something rather than passing everything.

The requirement about a taken address and a weak password is removed with a
migration note rather than deleted, because both rules survive — they moved to
the act they belong to, and refusing a taken address at the point of invitation
is better than refusing it after somebody has followed a link and chosen a
password.

### The threat model gets worse, and says so

G10 records that a lost administrator has no recovery path. Until this slice
that was softer than it sounded: `curl /auth/register` still made *an* account —
not an administrator, but a way in.

After this there is one path to any account at all, and it starts at a value in
the deployment's configuration. Losing the administrator's credentials leaves a
deployment reachable only through its database. That is the intended shape, and
the entry should describe it rather than let a reader infer the softer version.

### The accessibility record shows the gap rather than hiding it

The evidence table has a row for a screen about to not exist, and no rows for
`/accept-invite`, `/claim` and `/people` — added two slices ago and never
listed.

Those screens are not unmeasured: axe hard-gates all three in CI. What is
missing is a Lighthouse score, and only that. Splitting the table so the
automated gate and the manual score are separate columns turns three silent
omissions into one visible, honest gap.

## Risks / Trade-offs

- **Twenty-two specs stop exercising account creation** → They never meaningfully
  did; the enrollment capability has its own specs, at every level, including a
  browser journey. What those twenty-two exercise is what they are named after.
- **Seventeen end-to-end files now depend on enrollment** → Mitigated by
  ordering rather than by isolation, as above. If it becomes noisy, the fixture
  list is still available.
- **A deployment can be locked out** → The intended consequence of closing the
  door, recorded as G10 and now accurately. A transfer path is the natural
  follow-up if this ever runs for anybody but its operator.
- **A large diff across many files** → Nearly all of it mechanical, in tests,
  and reviewable as one shape repeated. The behavioural change is a route
  deletion and two spec requirements.

## Migration Plan

No schema and no data. Existing accounts are unaffected — they log in exactly as
before, whatever created them. A deployment that upgrades keeps every host it
had; it simply cannot gain another except by invitation. Rollback is restoring
the route, which nothing else depends on.

## Open Questions

- Should the API answer a request to the removed route with a 404, or with
  something that says registration is closed? A 404 is honest — there is no such
  thing — and says nothing about what used to be there. Left to whoever writes
  it; the acceptance scenario only requires that no account can be created.
