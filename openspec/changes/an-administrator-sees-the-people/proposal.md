## Why

An administrator can invite, revoke, resend and list — over `curl`. Seven
slices built every one of those and gave none of them a screen, so the person
the whole redesign is built around is the only one still using a terminal.

There is a smaller thing behind it that has to be fixed first, and it is the
reason this slice is not only screens: **the host app does not know whether the
person signed in is an administrator.** The session tracks loading,
authenticated and anonymous, and the probe that answers it fetches a list of
drafts only to throw the list away. So the app cannot show an administrator
their own link, or hide it from anybody else.

Slice A saw this coming. Its design kept the role in the session token
specifically because "it is still useful for deciding what the frontend
renders", while never being what authorizes anything. This is the slice that
uses it.

## What Changes

- The app learns who it is talking to. One small read answers *am I signed in*
  and *what am I* together, replacing a probe that asked the first question by
  fetching data it discarded.
- An administrator gets a link to the people in their deployment; nobody else
  sees it.
- **One list, not two.** Accounts and invitations are the same question asked at
  different moments — *does this person have access?* — so they are one list
  keyed by address. An account wins over any invitation to the same address, and
  where there is no account the newest invitation stands for the person. That
  second rule quietly settles something left open two slices ago: a resent
  invitation supersedes its predecessor, and the older one simply stops being
  the newest, so it disappears without anything having to chase a chain.
- Inviting gets a form, with the shape the claim screen already has: a message
  that went out gets a confirmation, and one that did not gets the link, once.
  It cannot be shown again — nothing stores it.
- Revoking and resending become buttons on the rows they apply to. Rows that are
  accounts carry no action, because removing a host is deliberately not in this
  redesign.
- A host who types the address of the panel is told plainly that it is not for
  them — and that refusal is recorded, because a host reaching for the
  administrative surface is exactly what that record exists for.
- The browser suite gets a shared setup step. Claiming a deployment happens once
  ever, so every specification that needs an administrator has had to crowd into
  the one file that does the claiming. That workaround was cheaper than fixing it
  until this slice; it stops being cheaper now.

## Capabilities

### Modified Capabilities

- `administrative-access`: the administrative surface gains a screen, and the
  app gains a way to know whether to offer it. Being refused it gains a page
  that says so.
- `host-enrollment`: inviting, revoking and resending gain the screen an
  administrator does them from, and the list they are done in.

## Impact

- `packages/api/src/http/auth-routes.ts` — one small read reporting who the
  caller is. The only API work in the slice, and the reason it is not screens
  alone.
- `packages/host-web/src/auth/session.tsx` and `api/client.ts` — the session
  carries the role; the drafts probe retires.
- `packages/host-web/src/pages/` — the panel, and a link on the home screen
  shown only to an administrator.
- `packages/host-web/src/app.tsx` — one route, named `/people` because `/admin`
  forwards to the API, exactly as `/invites` and `/setup` do.
- `playwright.config.ts` — a setup project that claims the deployment once, so
  the specifications that need an administrator can be written wherever they
  belong.
- One new locale namespace, in both languages.
- **Not in this slice:** removing open registration, which is the last one, and
  removing a host, which this redesign has never included.
