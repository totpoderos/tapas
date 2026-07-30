## Context

`packages/host-web` is eight React pages that each own their whole screen. Every one opens with `<main id="main">` and rebuilds its own chrome: a brand dot, a couple of links, a sign-out button, laid out slightly differently each time. There is no shared navigation, so `Home` is the only junction in the app — from a contest's activity log the only way to the assistant is back through `/`. `App` mounts each page directly under a route with a session guard, and nothing is shared between them but `useSession()` and the token stylesheet.

The handoff bundle (`Modern administration panel shell`, Direction A — Service desk) supplies eight full-page mockups at 1440×900 plus the states and dialogs. Every colour in them is already a token in `packages/ui/src/tokens.css`: `#6a2757` is `--brand`, `#f3e4ee` is `--brand-soft`, `#4e6b21` is `--good`, `#b23a2e` is `--danger`, `#f5efe8` is `--surface-2`, and so on through the whole file, which also means the dark theme comes free if nothing is hard-coded. The mockups are static HTML with inline styles; they are a target to match visually, not a structure to copy.

Three constraints shape the work. The panel must keep its accessibility guarantees (the repo hard-gates axe-core in Playwright, and the sidebar is new navigation on every screen). Every string must exist in English and Spanish. And authorization stays where it is: `whoAmI()` reports the role so the panel knows what to draw, and the API decides on every request — a hidden nav group is a courtesy, never a control.

The panel is also **one kind of workspace at a time**. `role` is already exclusive (`isAdministrator = role === 'admin'`), and the two kinds of work do not mix: an administrator's panel is the people of the deployment and nothing else, a host's panel is host work and carries no administrative group. This is a panel decision, not an authority one — `administrative-access` keeps its scenario that an administrator acting through a token can do a host's work, and that stays true.

The change also widens two reads and adds one rendering, because the design shows information the panel cannot currently get: per-contest progress and rules in the list, an activity log as a file, and a join code as a scannable code.

## Goals / Non-Goals

**Goals:**

- One shell — sidebar plus top bar — wrapping all eight surfaces, scoping itself to a contest when inside one and to the deployment otherwise.
- Visual parity with the mockups, expressed entirely in tokens so both themes work.
- The contest list readable without opening anything: rules in brief, join code, progress.
- The activity log exportable as a comma-separated file; the join code showable as a scannable code.
- No regression: existing host-web unit tests and `tests/e2e` host suites keep passing, axe-core keeps hard-gating.

**Non-Goals:**

- The design's **Deployment** item under the administrator-only group. There is no such screen and this change does not invent one.
- The top bar's **search** field ("Search contests, people, events…"). The API can find a contest by name, but there is no people or event search, and building one is its own capability. The top bar is built without it.
- Contest-scoped **Rules** and **Participants** ways-in for a *published* contest. Those screens exist only for a draft; a live contest's rules are read-only and the design already shows them, as "Rules in force", inside the control room. The contest-scoped navigation therefore offers Rules and Participants for a draft, and Control room / Activity log / Results for a published contest.
- A join **URL** in the scannable code — see the decision below.
- Re-tokening, a component library swap, or touching `packages/participant-web`.

## Decisions

### The shell lives in host-web; only the token-level pieces go in `@tapas/ui`

The shell knows about hosts, contests, drafts and administrators — host-panel domain, not design system. It goes in `packages/host-web/src/shell/`. What moves into `@tapas/ui` is the vocabulary the mockups repeat and the participant app could plausibly want: `StatePill` (wording + shape + tone), `ProgressBar`, `StatTile`, `Card`, `DataTable` (the bordered, header-shaded table frame), `Callout` (the saffron/danger notes), `EmptyState`.

*Alternative considered:* the whole shell in `@tapas/ui`, as the proposal first sketched. Rejected — it would drag `useSession`, the router and the contest model into a package whose only other consumer is the participant PWA, which has no sidebar and never will. Note for the pieces that do move: components in `@tapas/ui` must be given **full i18n key paths** (`common.x`), because the shared instance echoes a bare key back as the accessible name.

### The contest list is fetched once, into a provider the shell reads

The sidebar shows counts per state on *every* screen, so the list is no longer just `Home`'s data. A `ContestsProvider` mounted inside the authenticated tree fetches `listContests()` once, exposes `{state, refresh}`, and both the sidebar (counts, contest switcher) and `Home` (rows) read it. Mutations that change the list — delete, publish, close, reveal — call `refresh()`.

*Alternative considered:* each surface fetches its own copy. Rejected: N copies of the same list, and the sidebar counts would drift from the table on the very screen showing both.

### The contest list read is widened at the source, not stitched together client-side

`ContestSummary` gains four optional fields: `attribution`, `categoryCount`, `joinCode`, and `progress: {claimedCount, draftCount, sentCount}`. Absent — `null` over the wire — means "not applicable yet", which is how a draft reports every one of them, and how the panel tells "voting has not started" from "nobody has voted". `ListMyContests` gains the roster and vote-session repositories.

To keep that from becoming a query per contest, both repositories get a batched count: `countsByContest(contestIds): Map<contestId, number>` on the roster, and a grouped status count on vote sessions — one `... WHERE contest_id IN (...) GROUP BY contest_id` each. `GetTally` keeps its single-contest path; the batch is additive.

*Alternative considered:* let the panel call `getTally(id)` per row. Rejected — a host with twelve contests would fire twelve extra requests to draw one table, and the spec's "one request" scenario exists to forbid exactly that.

### Attribution is persisted at publish, not re-derived on read

`MaterializedContest` has no `attribution`; the compiler consumes it and emits dishes with one or two submitters. It is *inferable* (`submitterIds.length > 1` ⇒ per couple) but inferring it is re-interpreting a compiled-away rule at read time, which is precisely what the "compiled at publish, never re-interpreted at runtime" rule forbids — and it is genuinely ambiguous for a contest with an empty roster. So a migration adds a nullable `attribution` column to the contest row, written at publish from the draft.

**Revised while implementing:** the backfill of existing rows is dropped. Migrations here are plain `.sql` applied in filename order, and the only way to read attribution out of the old `materialized` JSON is engine-specific JSON functions — which would put SQLite-only SQL in a file that is supposed to keep the Postgres swap a swap. Since `NULL` already has a defined meaning the list must handle anyway ("this contest does not say", exactly as an unset draft reports), an un-backfilled row reports none rather than a guess. Only the category count and join code, which the compiled view and the contest row already hold, are available for contests published before this change.

### The activity log's file is produced by the API

`GET /contests/:id/audit?format=csv` returns `text/csv` with a `Content-Disposition` filename derived from the contest name, reusing the existing route's ownership check verbatim. The panel fetches it with credentials and saves it through a blob URL, so a 403 or 401 is rendered in the panel rather than replacing it with a raw error page.

*Alternative considered:* build the file in the browser from the entries already on screen. Rejected on two counts: the ownership rule would then live in two places (memory: the recurring bug in this repo is two paths that agree until one layer diverges), and the escaping below belongs next to the projection, not next to the table.

**CSV injection (OWASP A03).** A field beginning `=`, `+`, `-`, `@`, tab or CR is prefixed with an apostrophe so a spreadsheet renders it as text instead of evaluating it; fields containing a comma, quote or newline are quoted with quotes doubled. Audit entries carry `toolName` and `toolArgs` that originate from an assistant, i.e. from participant-influenced text, so this is a live path and not a theoretical one — it is the same "treat their text as data" rule the participant-name guard already applies elsewhere.

### The scannable code encodes the join code, and says so

`qrcode` (pure JS, no native build) renders to an **SVG string** via `toString(code, {type: 'svg'})` — no canvas, no `dangerouslySetInnerHTML` beyond a generated SVG, `currentColor`-friendly, and it scales at 200% zoom. Pinned, lockfile-committed, `npm audit` in CI already covers it.

It encodes the join code **text**, not a join URL. A URL would be the more useful thing to scan, but nothing in the deployment tells host-web the participant app's public address, and inventing a configuration entry for it is a separate change. This is a real limitation of the feature as shipped: scanning yields the code, which the person then types. The code stays printed beside the image, which is what makes that acceptable rather than broken.

*Alternative considered:* hand-rolled QR encoder to avoid a dependency. Rejected — several hundred lines of Reed–Solomon and mask-pattern selection is a worse supply-chain answer than one audited, pinned package.

### The navigation model is derived, not configured per page

One `usePanelNav()` derives everything from the current route, the session role and the provider's list: whether the sidebar is contest-scoped (the route carries a contest or draft id), which item is current, what the breadcrumb says, and which groups exist. Pages therefore say nothing about navigation — they render their surface into the shell's content slot. That is what stops the eight-way drift the current per-page chrome already shows.

The role picks the whole navigation, not a group within it: `role === 'admin'` yields the administrative navigation (the people, sign out, theme, language) and `role !== 'admin'` yields the host navigation. Because that makes the host surfaces unreachable for an administrator, `App` sends an administrator asking for one to the people, and `/` resolves per role rather than always to the contest list. Two consequences worth naming: the administrator's sidebar is a single way in today (People & access — **Deployment** is dropped, see Non-Goals), which is thin but honest; and `ContestsProvider` is mounted only for the host navigation, so an administrator's panel never fetches a contest list it would not draw.

Accessibility falls out of the same place: the sidebar is one `<nav aria-label>` landmark, the current item carries `aria-current="page"`, the existing skip link keeps targeting `#main` which is now the shell's content region (so skipping lands past the sidebar, not inside it), items are links at 44px minimum, and a contest's state keeps its mark (● ◇ ◆ ✓) beside its translated word.

### Sub-slices

Each is one ATDD loop — a `.feature` first, then implementation — and one PR.

- **A** — the shell, and the contest list on it (deployment-scoped sidebar, top bar, states, a11y, EN/ES). The direction becomes visible.
- **B** — the contest list read widened end to end (migration, repositories, `ListMyContests`, DTO, MCP tool), then consumed: progress bars, rules-in-brief, join code, sidebar counts.
- **C** — the control room on the shell: contest-scoped sidebar, breadcrumb, join code panel, progress card, drive-the-contest, rules in force, danger zone, the close/reveal confirmations.
- **D** — the join code as a scannable code.
- **E** — the rule space (new contest) on the shell, with the step sidebar.
- **F** — draft review on the shell: participants & pairing, can't-score-each-other, publish checklist.
- **G** — the activity log on the shell, with the source filter.
- **H** — the activity log leaves as a file.
- **I** — people & access on the shell, including the administrator-only group.
- **J** — the assistant on the shell, with the confirmation card.
- **K** — the results on the shell.

A lands first because everything else composes into it; B before the list slice that consumes it, as asked.

## Risks / Trade-offs

- **The shell is on every screen, so a mistake in it is a mistake everywhere** → it lands alone in slice A with its own axe-core coverage and unit tests, before any surface depends on its details.
- **Eleven PRs against eight pages will churn `tests/e2e`** → the suites assert host-visible text and roles, not layout, and the shell keeps `#main` and every existing accessible name. Where a selector does break, the fix is the selector, and the rule is that a green suite is not renegotiated to accommodate the redesign.
- **A widened list DTO is a wire change three consumers read** (host-web, MCP, the assistant's tool surface) → every new field is optional, so an old consumer keeps working; the MCP contract test is updated in the same slice as the DTO.
- **The batched counts are a new query shape on SQLite** → written as plain `IN (...) GROUP BY`, no SQLite-only syntax, so the Postgres swap stays a swap. An empty id list must short-circuit rather than emit `IN ()`.
- **`attribution` backfill is a guess for old rows** → nullable column, `null` renders as nothing rather than as a wrong rule; new rows are written from the draft and are exact.
- **A new dependency for the QR** → pure-JS, pinned, lockfile-committed, SVG output only, no network and no eval.
- **The scannable code carries a code rather than a link, which is less useful than the mockup implies** → the code is printed beside it and the limitation is recorded here; a join URL is a follow-on change once the participant app's public address is configured.
- **An administrator who owns a contest cannot reach it in the panel** → accepted, and the direct consequence of the host/administrator split. The API still permits it (a token is a separate path), so nothing is lost that was ever gained through the panel; if it becomes a real problem the answer is the explicit two-mode switch, not leaking host items back into the administrative sidebar.
- **The design's 1440px canvas says nothing about narrow screens** → the sidebar collapses to a top-anchored disclosure below the tablet breakpoint, and the existing `accessibility-reflow` suite is the gate for it. This is an addition to the design, made because a panel that only works at 1440px fails the reflow criterion the repo already enforces.

## Open Questions

- The mockups show a `···` overflow menu per contest row. This change collapses each row's actions to the ones that exist (Open / Review / Reveal / Results, plus Delete) and omits the menu; if the intent was a menu holding more than Delete, that is a follow-on.
- The top bar shows the signed-in host's initials and name. `whoAmI()` returns `hostId` and `role`, not a display name or email, so the avatar shows a role-derived label until the session read carries something nameable.
