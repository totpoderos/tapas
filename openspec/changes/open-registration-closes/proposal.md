## Why

Eight slices built a way for host accounts to come into existence: an
administrator invites an address, the person who holds that inbox opens a link
and chooses a password, and everything about that has a screen and an audit
trail. All of it works.

And `POST /auth/register` is still open. Anyone who knows the URL can still
create as many host accounts as they like, with no invitation, no
administrator, and no record of who let them in. The whole redesign exists to
replace that endpoint, and until it is gone the redesign is an alternative
rather than the way in.

## What Changes

- Open registration is removed: the route, the screen, the way the app called
  it, and its place in the router.
- **Nothing about creating an account is lost.** The use case that validates the
  address, enforces the password policy and stores the credential stays exactly
  where it is — accepting an invitation has called it since the invitation was
  built. Only the door that let anybody reach it disappears.
- The test suite learns a different way to have a host, and that is the bulk of
  this change: **43 files** create hosts by registering, including every
  participant journey, which needs a host only so that somebody can create the
  contest.
- After this, a deployment has exactly one path to any account at all — the
  address named in its configuration, the claim screen, and a link that is
  either mailed or shown. That path stops being a convenience and becomes the
  only one there is.

## Capabilities

### Modified Capabilities

- `host-authentication`: the requirement that a host registers and can log in
  becomes the requirement that a host *has an account* and can log in — the
  logging in and the never-storing-a-password-in-the-clear are still true, and
  still this capability's business. The requirement about registration being
  refused for a taken address or a weak password is removed, because both rules
  now live in `host-enrollment`: a weak password is refused when an invitation
  is accepted, and a taken address is refused when one is issued.

## Impact

- `packages/api/src/http/auth-routes.ts` — one route removed.
  `register-host.ts` is untouched, and its unit tests with it.
- `packages/host-web` — the sign-up screen, its component test, its two locale
  files, `session.signUp` and `client.register` all go, along with the route.
- **22 API acceptance specs** seed their host directly, the way the
  administrator role has been seeded since it existed. How a host came to be is
  not what a tally or a reveal spec is about; registering over HTTP was those
  specs asserting a mechanism they never cared about.
- **17 end-to-end files** get their host through one support helper that invites
  one for real. Every spec then depends on enrollment working — which is
  acceptable because the setup project already exercises that whole chain to
  create the administrator, and runs first, so a broken enrollment fails there
  before it fails anywhere confusing.
- `packages/mcp/tests/support/api-harness.ts` seeds, like the API specs.
- `docs/threat-model.md` — **G10 gets worse and should say so.** Until now a
  lost administrator still left `curl /auth/register` as a way to make some
  account. After this there is none: a deployment whose administrator is lost is
  reachable only through its database.
- `docs/accessibility.md` — the evidence table has a row for a screen that will
  not exist, and no rows for the three screens the last two slices added. Truing
  it up needs a browser for the Lighthouse scores, so those may land as a stated
  gap rather than a number.
