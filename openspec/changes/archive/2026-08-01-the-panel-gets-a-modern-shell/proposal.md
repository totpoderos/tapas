## Why

Every screen of the host panel is its own island: a centred column with a thin brand bar rebuilt page by page, no shared navigation, and no way to tell where you are or to get somewhere else without going home first. A host running a live contest has to leave the contest to reach its own activity log. The design handoff *Modern administration panel shell* (Direction A — Service desk) answers this with a persistent shell — a sidebar and a top bar that stay put while the eight host surfaces change inside them — and it is drawn entirely on the tokens already in `packages/ui/src/tokens.css`, in both themes, so the panel becomes a workspace without becoming a new visual language.

The design also asks the panel to say more than it currently can. It shows a host how each of their contests is going without opening it, hands the join code over by scanning as well as by copying, and lets an activity log leave as a file. Those are capability changes, not styling, and they are in scope.

## What Changes

- **A persistent shell**: a 248px sidebar and a 68px top bar wrap all eight surfaces (contest list, control room, rule space, draft review, activity log, people & access, assistant, results). The sidebar is **deployment-scoped** outside a contest (All contests with per-status counts, Assistant, Activity, People & access) and **contest-scoped** inside one (a switcher card for the contest, then Control room, Rules, Participants, Activity log, and Results once revealed). The top bar carries the breadcrumb, the primary actions, search, and the signed-in host.
- **Host work and administrative work do not mix**: which navigation is drawn follows what the API says the signed-in account is, and the other kind is absent rather than shown and refused. An administrator's panel offers the people of the deployment and nothing else — no contests, no assistant, no activity — and they land there on signing in. A host's panel offers host work and carries no administrative group. Nothing is authorized by what is drawn; the API keeps deciding, and an administrator keeps a host's powers there.
- **The contest list becomes informative**: each row shows its rules in brief, its join code, and how far along its voting is, with a progress bar. This needs the contest list to carry that information — today it carries only id, name, state and when it was last touched, and the tally and join code are readable one contest at a time.
- **The join code can be scanned**: the control room offers the code as a scannable code alongside copying it, so a host at a venue does not have to read it out.
- **The activity log can leave as a file**: a host can take their contest's log away as a comma-separated file, with the same rows, sources and actors the screen shows.
- **Every state is drawn**: the contest list's empty, loading and error states, and the three confirmations (close voting, reveal results, and deleting — including the typed-name escalation, which stays driven by the API's refusal and is never predicted client-side).
- Accessibility is held, not traded: the sidebar is a real navigation landmark, skip-to-main still lands on the surface, targets stay 44px, and state keeps its shape (● ◇ ◆ ✓) as well as its colour. Every new string is in English and Spanish.
- Not included, and deliberately: the design's **Deployment** item under the administrator-only group — there is no such screen, and inventing one is outside this change.

## Capabilities

### New Capabilities

- `host-panel-shell`: the panel's persistent navigation — what a host can reach from anywhere, how the sidebar scopes itself to a contest or to the deployment, which groups appear for whom, and the accessibility guarantees the shell must keep for every surface it wraps.

### Modified Capabilities

- `contest-management-api`: listing contests now reports, for each one, how its voting is progressing, its rules in brief, and its join code — so the list can be read without opening every contest.
- `manage-live-contest`: a host can hand the join code over as a scannable code, not only as text.
- `audit-log-visibility`: a host can take their contest's activity log away as a file.

## Impact

- `packages/ui` — the pieces the design repeats and the participant app could also want: the state pill, the data table frame, the stat tile, the progress bar, the callout, the empty state.
- `packages/host-web` — the shell itself (it knows about hosts, contests and administrators, so it belongs to the panel and not to the design system); all eight pages re-composed onto it; their per-page chrome removed; `api/client.ts` widened; EN/ES resources for every new string; existing unit tests kept green.
- `packages/api` and `packages/domain` — the contest-list read widened to carry progress, rules-in-brief and join code; the activity log's file form.
- `packages/mcp` — the contest-list tool follows the widened read, since it is a thin adapter over the same API.
- `tests/e2e` — a `.feature` per sub-slice; the existing host suites must keep passing against the re-composed screens, and axe-core keeps hard-gating.
- One new dependency for generating the scannable code, pinned and lockfile-committed.
