## Why

Slice A made administrative work real but left it with almost nothing to do:
an administrator can see who has an account, and cannot yet do anything about
it. Meanwhile `POST /auth/register` is still open to anyone who knows the URL.

This slice builds the mechanism that replaces open registration — an
administrator invites a specific email address, and the person who receives it
proves they hold that inbox by opening the link and choosing a password. That
single action is both the acceptance and the verification; there is no separate
"confirm your email" step and therefore no half-created account to reason
about.

Only the happy path is built here. An invitation that is accepted is the whole
story: expiry, revocation and resending are the next two slices, and open
registration is not removed until the bootstrap slice makes it possible to have
an administrator at all.

## What Changes

- An administrator can invite an email address. An invitation is created
  carrying a single-use token, of which only a hash is stored — the same
  discipline personal access tokens already use.
- A message is sent to the invited address carrying a link. The mailer is a
  port with an in-memory fake in this slice; nothing yet talks to a real mail
  server, and the test suite stays entirely offline.
- Opening the link reports whether it is still good and, if so, whom it is for
  — and changes nothing. The token is spent when the password is submitted, not
  when the link is opened, because link scanners and mail-security products
  fetch such URLs before a person ever sees them.
- Submitting a password creates a host account for the invited address and
  marks the invitation accepted. The account is an ordinary host; nothing in
  this slice can invite an administrator.
- Acceptance does not open a session. The caller signs in afterwards through
  the existing sign-in path, so the system keeps exactly one place that issues
  session cookies, and sign-ins keep appearing in the security log the one way
  they always have.
- A token that is unknown, or that has already been used, is refused with a
  single generic message — the same non-disclosure discipline that already
  governs a wrong password and an unknown email.
- Inviting, accepting, and failing to accept are recorded in the security log.
  Invitations are becoming the only route to a host account, so this is the
  audit trail for account creation itself.

## Capabilities

### New Capabilities

- `host-enrollment`: how a host account comes into existence by invitation —
  who may invite, what the invited person receives, what opening the link does
  and does not do, and what accepting creates. Expiry, revocation and resending
  are deliberately absent and arrive in the following slices.

### Modified Capabilities

- `security-event-logging`: adds the invitation events — issued, accepted, and
  refused — alongside the sign-in, token, and administrative-refusal events
  already recorded.

## Impact

- New migration creating an invitation table: address, token hash, status, and
  timestamps. A unique index on the token hash, mirroring `host_pats`.
- New mailer port in the API with an in-memory fake for tests. First outbound
  side effect in the system; no real provider is configured in this slice.
- `packages/api/src/http/admin-routes.ts` — gains the invite route behind the
  administrative check that landed in slice A.
- New anonymous routes for opening and accepting an invitation, both carrying
  the sensitive rate limit from `packages/api/src/http/rate-limit.ts`, since
  they are unauthenticated and their token is guessable.
- `packages/api/src/auth/use-cases/register-host.ts` is reused by acceptance
  rather than duplicated — the password policy, the email validation and the
  taken-email check all apply unchanged.
- `packages/api/src/security/security-event.ts` — three new event types.
- No frontend. The screens for inviting and for accepting are slice C.
- `POST /auth/register` is untouched and still open; closing it is slice E.
