## Why

Six slices built an enrollment path with nowhere to land. The link in every
invitation points at `/accept-invite/:token`, a route the host app does not
have — so a message that arrives correctly, carrying a token that works, takes
its recipient to a redirect and then a sign-in screen for an account they do
not yet have.

The same is true one level up. A fresh deployment names its administrator in
configuration and waits to be claimed, and the only way to claim it is a
hand-written request. `/sign-in` is where every unrouted path leads, and on a
deployment with no accounts it is a dead end.

Both screens are small. What makes them worth their own slice is that they are
the first anonymous pages this app has had since sign-in, and the first that
have to be honest about things they are deliberately not told.

## What Changes

- An invited person opening their link gets a page. It shows the address the
  invitation was sent to and asks for a password; choosing one makes their
  account and signs them in.
- A link that does not work gets one honest page. The API answers the same way
  whether it never existed, was used, ran out of time, was revoked, or was
  replaced — so the page says it may have expired or already been used, and to
  ask for a new one. It offers no way to tell which, because there is none.
- A deployment nobody has claimed offers to be claimed, at a route of its own,
  and says plainly when it has been. It needs no session to decide either — it
  asks and renders the answer.
- Whoever is anonymous on an unclaimed deployment is sent there. That is **the
  only conditional redirect in the app**, and the claim screen stays reachable
  once claimed on purpose: two redirects facing each other could disagree in the
  moment somebody is claiming, and a browser bounces between them.
- Both screens show the link when the message could not be sent. On a first
  deployment whose mail is not configured yet — which is ordinary — this is the
  difference between a usable setup and waiting for a message nobody sent.
- Accepting signs the person in afterwards through the ordinary sign-in path.
  When that second step is refused for hammering the sensitive rate limit, the
  page says the account is ready and points at sign-in. It never suggests the
  acceptance failed, because it did not.

## Capabilities

### Modified Capabilities

- `host-enrollment`: the invited person's side becomes something they can see
  and do rather than something a request performs. Accepting gains its screen,
  and the refusal that says nothing gains a page that says nothing helpfully.
- `admin-bootstrap`: claiming gains its screen, and a deployment that has been
  claimed gains a plain answer for anyone who arrives at it later.

## Impact

- `packages/host-web/src/pages/` — two pages. The acceptance page is the
  existing sign-up screen minus its email field, which slice E then deletes.
- `packages/host-web/src/app.tsx` — two anonymous routes, and one conditional
  redirect. The catch-all is untouched: everything already funnels through
  `/sign-in`, so making that one route aware is enough.
- `packages/host-web/src/auth/session.tsx` — accepting joins signing up and
  signing in, in the same accept-then-sign-in shape.
- `packages/host-web/src/api/client.ts` — three reads and writes it does not
  have yet.
- Two new locale namespaces, in both languages.
- `tests/e2e` — the first browser journey to follow a link out of a real
  message, which slice C1 made readable.
- **No administrative screens.** The panel is C3, and open registration is not
  removed until E.
