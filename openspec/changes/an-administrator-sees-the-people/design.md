## Context

Every administrative action this redesign built already works. What is missing
is the person doing them having anywhere to do them from — and one thing
standing in the way that is not a screen at all.

Three things in the existing code decide the shape:

- **The session does not carry a role.** `session.tsx` tracks `'loading' |
  'authenticated' | 'anonymous'`, and `hasSession()` answers the second question
  by fetching `GET /drafts` and discarding the result. Nothing in the app knows
  an administrator from a host.
- **Slice A left the door open for exactly this.** Its design kept the role
  claim in the token on the grounds that it "is still useful for deciding what
  the frontend renders", while making the account store the only thing that
  authorizes. Rendering is precisely this slice's use.
- **`/admin` forwards to the API**, as `/invites` and `/setup` do, and `app.tsx`
  already documents that trap twice at other routes.

## Goals / Non-Goals

**Goals:**

- An app that knows what it is talking to, in one honest read.
- One list that answers "does this person have access?" in one place.
- Inviting, revoking and resending done from a screen.
- Browser specifications that can be written where they belong rather than
  where the deployment happens to get claimed.

**Non-Goals:**

- Removing a host. Never part of this redesign, and the list offers no action on
  an account partly to make that visible.
- Removing open registration. The last slice.
- Any change to what the administrative API decides or refuses. This renders
  answers already given.
- More than one administrator. The database still allows exactly one.

## Decisions

### Knowing your own role costs one read, and never a refusal

A small `GET /auth/me` reports the caller and their role, replacing the
`GET /drafts` probe — which asked "am I signed in?" by fetching a list it threw
away, and could not have answered the second question at all.

**The alternative worth naming, because it is the tempting one:** discover the
role by requesting something administrative and treating `403` as "not an
administrator". It needs no new endpoint and it is actively harmful. Every
ordinary host would fire `admin_access.refused` on every page load, and the one
record that means *somebody reached for something they should not have* would
become the most common line in the security log. Slice A built that signal; this
slice must not bury it.

The role reported here is for rendering only. Nothing on the server trusts it —
`requireAdministrator` still reads the account store, for the reason slice A
gave: a refresh carries the previous token's claim forward, so a claim-derived
role would survive a demotion.

### One list, keyed by address, with the join rule written down

An account beats any invitation to the same address; where there is no account,
the newest invitation stands for the person.

Both halves earn their place. The first is needed because, after the previous
slice, most accounts *also* have an accepted invitation behind them — without it
the list doubles. The second is subtler: resending creates a second invitation
for one address, and "newest" makes the superseded one simply stop being the
newest. It disappears without anything following `superseded_by`, and it settles
the question slice C1 left open about whether to hide superseded rows. The join
answers it rather than a filter.

The alternative — two sections, hosts and invitations — needs no join and no
rule, and makes an administrator look in two places to learn whether one person
has access. The rule is small enough to state; the second lookup is not.

### The panel is at `/people`, and refusal is a page rather than a redirect

`/admin` forwards to the API, so a browsable route there would be proxied away
on a direct load or a reload.

A host who arrives is told the screen is not for them and left where they are.
The previous slice learned this the hard way: a redirect that depends on server
state locked hosts out of a screen they could have used, and the browser suite
found it. A page that says one true thing cannot do that.

Their attempt is recorded, and that is not incidental. `admin_access.refused`
exists for somebody reaching the administrative surface without the authority
for it, and a host typing this address is that. The whole reason the role probe
must not use a `403` is to keep this record meaningful.

### The setup project earns itself here

The previous slice put every enrollment specification in one file because the
suite runs a single in-memory API and a deployment is claimed once ever — a
second file that also claimed would race the first, and file ordering would pick
the winner.

That was cheaper than fixing it for one file. It stops being cheaper now, with a
second screen wanting an administrator. A Playwright setup project claims the
deployment once and the other projects depend on it, after which any
specification may assume an administrator exists and can live where its subject
lives.

## Risks / Trade-offs

- **A new endpoint reporting the caller's role** → It reports what the caller
  already holds in their own cookie, to their own app, and nothing about anyone
  else. It is not a new disclosure; it is the app being told what the browser is
  already carrying.
- **The rendered role can be stale after a demotion** → Until the access token
  rotates, a demoted administrator's app may still draw the link. Clicking it
  gets a refusal from the server, which reads the account store. The screen is
  wrong for a few minutes; the authority never is.
- **The join hides invitations an administrator might expect to see** →
  Deliberately: superseded and accepted invitations are history, not access. If
  the audit of who was invited when matters, the security log has it, and it is
  the right place for it.
- **The setup project changes how every specification starts** → It runs once
  and claims; nothing else about the existing files changes. Worth doing in a
  slice that also has screens to check it against, rather than alone with
  nothing exercising it.

## Migration Plan

None. No schema and no change to any existing API answer — one endpoint is
added and one frontend probe is replaced. Rollback is deleting the endpoint, the
page, the link and the setup project.

## Open Questions

- Should the list show when somebody was invited, or only how they stand? A date
  is useful for judging whether to resend and is one more column to make
  responsive. Left to whoever builds it against the designs.
