## Why

The system claims three roles (admin/host/voter) but only ever assigns two.
`admin` exists as a type that no code path ever produces, there is no way to
check for it, and no work is reserved to it — `docs/threat-model.md` carries
this as gap **G3**, accepted for v1 with the disposition "either build it or
drop the design claim in a later slice."

It has to be built now because the host enrollment redesign makes an
administrator the *only* way a host account can come into existence. Every
later slice of that redesign — inviting, revoking, resending, bootstrapping —
depends on there being a real notion of administrative work and a real check
guarding it. This slice builds that notion and nothing else.

## What Changes

- An administrator becomes a real, assignable role rather than an unused type,
  and administrative work becomes a category of work the system recognises and
  reserves.
- Administrative work is refused to an ordinary host, distinctly from the way
  it is refused to someone not signed in — being signed in as the wrong kind of
  person is a different answer from being nobody.
- **BREAKING (spec-level):** a personal access token no longer carries the full
  authorization of the host who issued it. It carries host powers only. An
  administrator acting through a token can do everything a host can do and
  nothing administrative. This narrows an existing guarantee in
  `host-access-tokens`; it matches what the implementation does today, but the
  spec currently promises the opposite, so a later "fix" to the code would be
  reading the spec correctly.
- An attempt at administrative work that is refused for lack of the role is
  recorded in the security log, because a host reaching for administrative work
  is a privilege-escalation signal and nothing else in the log would show it.

Deliberately **not** in this slice: invitations, enrollment, the admin panel,
and any way to *become* an administrator. Those are later slices of the same
redesign. Here an administrator is presumed to exist.

## Capabilities

### New Capabilities

- `administrative-access`: who may do administrative work — an administrator
  may, an ordinary host may not, nobody signed in may not, and no personal
  access token may, whoever issued it.

### Modified Capabilities

- `host-access-tokens`: the requirement that a token grants "the same identity
  and authorization as the issuing host's own session" is narrowed — a token
  grants host authorization only, never administrative authorization, even when
  the issuing account is an administrator.
- `security-event-logging`: adds the refused-administrative-attempt event to
  the sign-in and token events already recorded.

## Impact

- `packages/domain/src/auth/host-account.ts` — `HostRole` finally has a
  producer; `rehydrate` already carries the role, `register` hardcodes `'host'`
  and stays that way (nothing in this slice creates an administrator).
- `packages/api/src/http/require-host-session.ts` — the PAT branch pins
  `role: 'host'`; that line becomes load-bearing and specified rather than
  incidental. A new role check composes on top of the existing session check.
- `packages/api/src/http/` — a new authorization step usable as a preHandler by
  the routes later slices add. No existing route changes hands.
- `packages/api/src/audit/` + the security log — one new event type.
- `docs/threat-model.md` — gap **G3** moves from accepted-for-v1 to closed.
- No database migration: `host_accounts.role` already exists and is already
  read back through `rehydrate`.
- No frontend change. Nothing an administrator can do has a screen yet.
