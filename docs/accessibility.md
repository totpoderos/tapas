# Accessibility pass — WCAG 2.1 AA

*Task 6.12. What is automated and enforced, what was audited by hand, the results,
and the honest limits of both.*

**Target: WCAG 2.1 Level AA**, on both apps. Accessibility here is not a
compliance checkbox: the participant app is used **live at a venue** — standing
up, one-handed, in bad light, on whatever phone someone has, often with the system
font size turned up. That is WCAG's "temporary disability / bright sunlight" case,
so it is core UX (design.md §11C).

---

## 1. What is enforced automatically (every PR)

| Layer | Tool | Scope | Gate |
|---|---|---|---|
| Component | `jest-axe` | 12 test files across both apps — each screen, plus modal-open states | blocks |
| Whole-system | `@axe-core/playwright` | 12 E2E specs — every screen in a real browser, mid-journey | blocks |
| **Reflow / zoom** | Playwright at 320 px | the score screen and the reveal | blocks |
| Manual | checklist below | keyboard · screen reader · zoom | reviewed per release |

Both axe layers run inside the CI hard gate, so **a violation fails the build**
([`ci.yml`](../.github/workflows/ci.yml)).

### Finding: the axe ruleset was WCAG 2.0, not 2.1

The E2E scans were configured `withTags(['wcag2a', 'wcag2aa'])` — **WCAG 2.0** A/AA.
The stated target is **2.1 AA**, so every 2.1-specific success criterion was going
unchecked, including **1.4.11 Non-text Contrast**, **1.4.12 Text Spacing**, and
**1.4.13 Content on Hover or Focus**.

Fixed: all 12 specs now run

```ts
.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
```

**Result: 56/56 E2E still pass under the stricter ruleset** — the apps were
genuinely clean, not merely clean against a weaker bar. But that was luck rather
than proof until now, and it is exactly the kind of drift a pass is for.

### Added: an automated reflow test (1.4.10)

Axe cannot check **1.4.10 Reflow** — it evaluates the DOM it is handed and never
resizes the viewport. So [`accessibility-reflow.spec.ts`](../tests/e2e/accessibility-reflow.spec.ts)
drives the two screens the task calls out at **320 × 512** (the WCAG-referenced
small-screen target: 640 px at 200 % zoom) and asserts both that the document does
**not** scroll sideways and that the journey still completes:

- **scoring** — reflows, and a participant can still score every dish and send their vote
- **the reveal** — reflows, and the winner is still announced
- **the join screen** — reflows with the shared language and theme controls mounted

> **This test earned its keep.** Extending it to the join screen (when the language
> selector landed) failed immediately and exposed a **pre-existing 1.4.10
> violation**: `FormField`'s input had no `width`, so it took the browser's
> intrinsic ~20-character size — and the join-code field's 22px monospace with wide
> letter-spacing made that ~310px inside a 280px column, scrolling the page
> sideways at 320px. The fix is in `form-field.module.css`: `width: 100%` plus
> `min-width: 0`, and `grid-template-columns: minmax(0, 1fr)` on the wrapper —
> grid and flex items floor at their content's intrinsic width unless told
> otherwise, so the *column* has to be allowed to shrink, not just the wrapper.
> Every form field in both apps benefits.

Both pass.

---

## 2. Lighthouse

Run against the real stack (Chromium headless, `--only-categories=accessibility`):

| Screen | Score | Failing audits |
|---|---|---|
| Host app — sign-in | **100 / 100** | none |
| Host app — sign-up | **100 / 100** | none |
| Participant app — join | **100 / 100** | none |
| Participant app — join via `/j/:code` deep link | **100 / 100** | none |

Reproduce:

```bash
npm run dev                      # or point at any running instance
npx lighthouse http://localhost:5173/ --only-categories=accessibility --view
```

> **Limit, stated plainly:** Lighthouse and axe together catch roughly a third to a
> half of real accessibility defects. They cannot judge whether a label is
> *meaningful*, whether focus order is *sensible*, or whether an announcement is
> *useful*. That is what §3 is for.

---

## 3. Detailed checklist

Covers both apps. Each row names **how** it was verified — automated test, axe
rule, or code inspection — because "we checked accessibility" is worth nothing
without saying what the check was. Where a check needs a human ear, that is said
plainly rather than ticked (§3.2, §4).

### 3.1 Keyboard only (no mouse)

Mostly **automated**: every E2E spec includes a keyboard-operability test that
drives the journey with `Tab`/`Enter`/`Escape` only, so these are enforced per PR
rather than asserted once.

| Check | Evidence | Result |
|---|---|---|
| Every interactive element reachable with Tab / Shift+Tab | E2E keyboard tests (12 specs) | ✅ |
| Visible focus at all times | `:focus-visible` in [`tokens.css`](../packages/ui/src/tokens.css); `outline:none` never used | ✅ |
| Focus order follows reading order | code — **0 positive `tabindex`**, DOM order = visual order | ✅ |
| Skip-to-main link, first tab stop | `.tp-skip`, revealed on focus | ✅ |
| Enter / Space activate controls | code — **0 clickable `<div>`s**; real `<button>`/`<a>` throughout | ✅ |
| **Modals trap focus; Escape closes** | E2E asserts focus opens on the **safe** default (Cancel), Tab cycles inside, Escape cancels, focus restored — in *both* the chat panel and the control room | ✅ |
| No keyboard trap outside modals | E2E journeys complete keyboard-only | ✅ |
| Score screen fully operable | E2E scores + sends keyboard-only; radio groups are natively arrow-navigable, ranking uses real `<select>` | ✅ |

### 3.2 Screen-reader *semantics*

> **Evidence type — read this before trusting the ticks.** The rows below are
> verified by **code inspection plus automated assertions** (axe checks label
> binding, accessible names, ARIA validity and landmark structure; the E2E queries
> elements *by role and accessible name*, so a missing or wrong name fails the
> test). They are **not** the result of a human listening to a screen reader.
> **No screen-reader session has been run** — that remains outstanding, and it is
> the single biggest gap in this pass (§4). Semantics being correct is necessary
> for a good screen-reader experience, but it is not sufficient.

| Check | Evidence | Result |
|---|---|---|
| Page has one `<h1>`; headings nest correctly | axe (`heading-order`, `page-has-heading-one`) | ✅ |
| Landmarks present (`<main>`, `<nav>`) | code — 12 files; axe `region` | ✅ |
| Every form field has a bound `<label>` | `FormField` binds label↔input; axe `label` | ✅ |
| Errors announced, not just coloured | `aria-invalid` + `role="alert"` in `FormField`; component tests assert the alert | ✅ |
| Dynamic content marked for announcement | `aria-live` / `role="log"` present in 11 files (tally, chat, vote-sent, reveal) | ✅ |
| Icon-only controls have accessible names | axe `button-name` / `link-name`; E2E queries by name | ✅ |
| Decorative imagery hidden | reveal trophy is `aria-hidden="true"` | ✅ |
| **Confirmation card exposed as a dialog** | `role="alertdialog" aria-modal` + labelled message; E2E asserts focus lands on Cancel | ✅ |
| Status conveyed by more than colour | contest states are **word + shape + hue** (`● Live`, `◇ Draft`, `◆ Closed`, `✓ Revealed`) | ✅ |

### 3.3 Zoom / reflow / text

| Check | Result |
|---|---|
| 200 % zoom, no horizontal scroll, nothing clipped | ✅ automated at 320 px (§1) |
| 400 % zoom on desktop (≈320 px) | ✅ same test covers the equivalent width |
| Text resize to 200 % without loss of function | ✅ layout is relative units (`rem`/`%`), not fixed `px` widths |
| Touch targets ≥ 44 × 44 px | ✅ enforced in tokens; participant controls ≥ 56 px |
| Inputs ≥ 16 px (prevents iOS zoom-on-focus) | ✅ |
| Contrast ≥ 4.5:1 body / 3:1 large | ✅ axe checks every screen |
| Respects `prefers-reduced-motion` | ✅ reveal animation neutralised in [`tokens.css`](../packages/ui/src/tokens.css) |
| Works in both light and dark themes | ✅ tokens define both; axe runs against the default |

### 3.4 Two contrast lessons worth keeping

1. **Saffron (`#e39b12`) fails as *text*** on the light ground — 2.24:1. It is used
   as an **accent** (winner underline, tinted row) with dark `--ink` text, never as
   a text colour. Caught by axe during the reveal slice.
2. **A fade-in animation can fail contrast mid-frame.** The reveal's entrance
   animation tripped axe on an intermediate opacity frame. The a11y E2E now emulates
   `prefers-reduced-motion: reduce`, which the tokens honour instantly — giving axe a
   stable final frame *and* validating the reduced-motion requirement in the same test.

---

## 4. Known limits

Stated rather than glossed:

- **No screen reader has actually been run** — not VoiceOver, not NVDA, not JAWS,
  not TalkBack. §3.2 verifies that the *semantics* are correct (roles, names,
  labels, live regions), which is necessary but **not sufficient**: only listening
  reveals whether an announcement is timely, ordered sensibly, or merely noisy.
  Given the participant app is mobile-first, a **mobile screen-reader pass is the
  single most valuable next test**, followed by NVDA (screen readers differ
  materially in how they treat `aria-live` and `alertdialog`).
- **No testing with actual assistive-technology users.** Expert/automated review is
  not lived use, and that gap is real.
- **Automated coverage catches roughly a third to a half of issues** — everything
  outside that is judgement, and here it is one developer's judgement.
- **Cognitive accessibility not assessed** (reading level, time pressure at the
  venue, error recovery) despite being squarely relevant to a live event.
- **No formal accessibility statement** published for end users.
- Contrast is verified in the **default** theme; the dark theme is token-defined and
  spot-checked, not exhaustively audited.
- The reflow test covers **two** screens (score, reveal). Other screens are
  responsive by construction but not asserted at 320 px.

---

## 5. Reproducing this pass

```bash
npm test                    # component-level jest-axe (blocks)
npm run test:e2e            # 58 E2E incl. 12 axe scans + 2 reflow tests (blocks)
npx lighthouse http://localhost:5173/ --only-categories=accessibility --view
```

The outstanding manual work (§4) is the part a machine cannot do: turn on a screen
reader (VoiceOver `⌘F5`, or TalkBack on a phone — the mobile pass matters most
here) and listen to the join → dish → score → send → reveal journey, checking that
announcements arrive when they should, in a sensible order, without chatter.
