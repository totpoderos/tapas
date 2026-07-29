## Why

Nothing in a running deployment can create an administrator. The role is
enforced, invitations work, and the whole enrollment surface sits behind a door
that nobody can open — administrators exist only in test fixtures. On a real
deployment today, `/admin/*` is unreachable by construction.

This closes the last of threat-model gap **G3**, and it is the slice everything
else has been waiting on: without it, the admin panel has nothing to develop
against and open registration cannot be removed, because removing it would leave
no way to create any account at all.

## What Changes

- A deployment names its administrator in configuration, before it starts:
  `ADMIN_BOOTSTRAP_EMAIL`, validated at boot like every other setting, and
  refused in production if it is still the committed development value.
- While no administrator exists, that address — and only that address — can
  claim the instance. Submitting it issues an invitation, which is accepted the
  same way every other invitation is: open the link, choose a password.
- **The email round-trip is not what secures this.** It proves the claimant
  holds the inbox they typed, which at first run is their own. What secures it
  is that the address was chosen out of band by whoever controls the deployment.
  Without that pin, whoever reached the URL first would become administrator —
  and the window opens the moment the stack is up, before the operator has
  opened a browser.
- Submitting the configured address again while an invitation is outstanding
  sends a fresh link and kills the old one, so a message lost in transit can
  never leave a deployment unclaimable.
- Once an administrator exists the door closes, and an attempt to claim an
  instance that is already claimed — or to claim it with the wrong address — is
  recorded. Somebody trying is exactly what the security log is for.
- Accepting a bootstrap invitation produces an administrator. Every other
  invitation still produces an ordinary host, and a database constraint makes a
  second administrator impossible regardless of what any code asks for.

## Capabilities

### New Capabilities

- `admin-bootstrap`: how a deployment gets its first and only administrator —
  who may claim it, when the door is open, what closes it, and why the address
  is named in configuration rather than typed by whoever arrives first.

### Modified Capabilities

- `host-enrollment`: the requirement that accepting an invitation never
  produces an administrator becomes the narrower and true one — an *ordinary*
  invitation never does.
- `security-event-logging`: claiming an instance, and failing to, are recorded.

## Impact

- `packages/api/src/config/env.ts` — one new setting, with the same
  refuse-to-boot-in-production treatment `JWT_SECRET` and
  `ASSISTANT_CONFIRMATION_SECRET` already get.
- Migration adding the invited role to the invitation table, and a unique
  partial index on the administrator role — at most one administrator, enforced
  by the database rather than by a check that could race.
- New anonymous setup routes, carrying the sensitive rate limit: one asking
  whether the instance is unclaimed, one claiming it.
- `packages/api/src/auth/use-cases/accept-invitation.ts` and `register-host.ts`
  — an account's role becomes something the invitation carries rather than a
  constant.
- `packages/api/src/security/security-event.ts` — three new event types.
- **No frontend.** The first-run screen belongs with the other screens in the
  admin-panel slice; this slice makes it possible and answers the question it
  will ask. Until then a deployment is claimed with one request, which is what
  an operator would do on first deploy in any case.
- The test-support promotion helper stays, and stays test-only — it seeds
  administrators for the many specs that need one without going through setup.
