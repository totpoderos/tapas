## Context

The host app has had exactly two anonymous screens since it was built —
sign-in and sign-up — and every other route is `authed ? <Page/> : <Navigate
to="/sign-in"/>`. This slice adds two more, and they are anonymous for
different reasons: one because its visitor has no account yet, the other
because the deployment has nobody at all.

Three things in the existing code decide most of the shape:

- **`sign-up.tsx` is already the acceptance page.** The same card, the same
  split between field-level errors (`WEAK_PASSWORD`, `INVALID_EMAIL`) and
  form-level ones, and `session.signUp()` doing register-then-sign-in. The
  acceptance page is that screen with the email field removed and the address
  supplied by the API. Slice E then deletes the original.
- **`app.tsx` already documents the proxy trap twice**, at `/review/:id` and
  `/results/:id`, in a comment sitting on the route it protects. Both new routes
  need the same, and `/accept-invite` and `/claim` are named the way they are
  because `/invites` and `/setup` now forward to the API.
- **The app already makes one request before it renders anything.**
  `session.tsx` probes `hasSession()` on mount and holds a quiet status until it
  answers. Anything else the router needs to know can ride that moment instead
  of adding one of its own.

## Goals / Non-Goals

**Goals:**

- A place for every invitation link to land, including the ones that no longer
  work.
- A first run that can be completed in a browser, including when mail is not
  working yet.
- One conditional redirect, not two.
- Screens that are honest about what they were not told.

**Non-Goals:**

- The administrator's panel. C3.
- Removing sign-up. E, which also removes the screen this one is modelled on.
- Any change to what the API says or refuses. This slice renders decisions that
  are already made.
- A general "setup wizard". There is one thing to set up and it happens once.

## Decisions

### One conditional redirect, and the claim screen stays reachable

`/sign-in` sends an anonymous visitor to `/claim` when the deployment has no
administrator. `/claim` sends nobody anywhere.

The tidier-looking alternative — hide `/claim` once claimed by redirecting it
back to `/sign-in` — puts two conditions in opposition, each reading server
state at a different moment. They disagree exactly while somebody is claiming
the deployment, which is the one minute this route exists for, and a browser
resolves that disagreement by bouncing between them. One redirect cannot loop.

Keeping it reachable also gives an operator who bookmarked it an explanation
instead of a silent bounce, and costs nothing: `GET /setup/admin` is already
anonymous and already answers the same question to anyone who asks.

The catch-all needs no change. It already funnels every unrouted path to
`/sign-in`, so making that one route aware covers the app.

### The claim screen has no session guard at all

Every other route in this app asks who is signed in. This one asks the API what
the deployment is, and renders the answer — the same page for a stranger, a
host, and an administrator.

That is unusual enough to be worth a comment at the route, because the obvious
"improvement" is to wrap it like its neighbours, and doing so would break the
case it exists for: nobody is signed in on a deployment nobody has claimed.

### The unclaimed check rides the probe that already runs

`session.tsx` holds the app on a quiet status while `hasSession()` answers.
Asking whether the deployment is claimed happens on the anonymous branch of that
same moment — so a signed-in host makes no extra request, and an anonymous
visitor makes one, at the point where the answer changes where they go.

The alternative of asking on every boot regardless is one request wasted on
every host, forever, to learn something only anonymous visitors act on.

### The unusable-link screen offers a hint list, and that is not a leak

The API answers identically for five reasons, and this slice does not weaken
that. The screen says the link may have expired or already been used, and to ask
for a new one.

*May* is doing real work there. The property the earlier slices protect is that
the **answer** does not distinguish — not that the categories are secret. A
static sentence naming possibilities tells one holder exactly what it tells
every other, which is the whole point. What the screen must never do is vary.

It also names nobody: the address is shown only on the screen that could load
the invitation, never on the refusal.

### The delivery-failure link belongs on the screen, not in a corner

Both screens render it when the API reports the message did not go out, and the
claim screen in particular treats it as a normal outcome rather than an error
state.

A first deployment whose mail is not configured yet is the common case, not the
unlucky one — and it is the single situation in this system where nobody exists
who could resend. A screen that says "check your inbox" there is worse than
useless; it is confidently wrong.

### A refused sign-in after a successful acceptance is its own message

Accepting and signing in are two requests, and the second carries the sensitive
rate limit. When it is refused, the account exists and the link is spent, so
"something went wrong, try again" would send somebody back to a link that no
longer works, to be told it cannot be used.

The screen says the account is ready and offers sign-in. This is the one place
where the page knows more than either request alone does, and it has to say so.

## Risks / Trade-offs

- **The acceptance page shows an email address to whoever holds the link** →
  Deliberate, and already what the API returns: the token is the secret, and its
  holder is the person it was sent to. Worth being seen to have chosen rather
  than stumbled into.
- **`/claim` reveals whether a deployment is unclaimed** → It already did.
  `GET /setup/admin` is anonymous by design, because the screen has to know what
  to render, and a stranger learns nothing they could act on without the
  configured address.
- **Two screens now duplicate sign-up's card and error handling** → For one
  slice. E deletes sign-up, after which the acceptance page is the only screen
  of its shape. Extracting a shared form now would abstract across a twin that
  is about to be removed.
- **The unclaimed check adds a request for anonymous visitors** → One, on the
  branch that already waits. A signed-in host never makes it.

## Migration Plan

None. No schema, no API, no stored state — the slice renders answers the
backend already gives. Existing routes are untouched apart from `/sign-in`
gaining a condition, and rollback is deleting two pages and that condition.

## Open Questions

- Should the acceptance page offer a way back for somebody who arrives with a
  dead link and does have an account — a sign-in link rather than only "ask for
  a new one"? It is friendlier, and it slightly muddies a screen whose job is to
  say one thing. Left for whoever writes the copy to feel out against the
  designs.
