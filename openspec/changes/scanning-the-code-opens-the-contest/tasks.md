## 1. The acceptance spec, first

- [x] 1.1 Write `packages/api/tests/acceptance/reading-the-link-that-joins.feature` from the `contest-management-api` delta: a host reads a live contest and is given a join link carrying that contest's join code; two contests give two different links; the link carries the participant address and the code only; the link leads to the deployment's own participant app. Domain language only — no endpoints, no field names.
- [x] 1.2 Confirm the feature file with the user before writing any implementation, as the ATDD loop requires.
- [x] 1.3 Write its `.feature.spec.ts` runner against the real API with a configured participant address, and watch it fail for the right reason (no link reported) rather than a setup error.

## 2. The API reports the link

- [x] 2.1 Add the join-link composer as its own named unit (participant address + join code → link), unit-tested first: it joins the two, normalises a trailing slash on the address, and leaves the code's case alone.
- [x] 2.2 Thread `PARTICIPANT_WEB_ORIGIN` from `composition.ts` into the server deps as its own named dependency — not read by position out of `security.allowedOrigins`.
- [x] 2.3 Give `toContestDto` the participant address and have it emit `joinUrl` beside `joinCode`; update its callers (read by id, read by name, close, reveal) so all four pass through the one seam and cannot disagree.
- [x] 2.4 Make the acceptance spec from 1.1 pass, and check the existing API acceptance suites that assert on the contest read shape still hold.
- [x] 2.5 Confirm the publish responses, the contest list and the by-name details shape are untouched — the scope decision in the proposal, verified rather than assumed.

## 3. The panel encodes the link

- [x] 3.1 Add `joinUrl` to `ContestDetail` and its DTO in `packages/host-web/src/api/client.ts`, required rather than optional, per the design's "a missing link is a failure, not a fallback".
- [x] 3.2 Rewrite `packages/host-web/tests/unit/scannable-code.test.tsx` first: the component encodes the value it is given (recomputed independently, not snapshotted), names itself by the join code and not the link, and still leaves its quiet border, inherited colour and viewBox sizing intact.
- [x] 3.3 Change `ScannableCode` to take what to encode and the code that names it as separate props, and rewrite its doc comment — the current one explains a decision this change reverses.
- [x] 3.4 Pass the contest's join link from `contest-control.tsx`, leaving the printed code and the Copy code button exactly as they are.

## 4. End to end, at the venue

- [x] 4.1 Extend `tests/e2e/host-join-code-scannable.spec.ts`: decode the rendered symbol and assert it is the participant address carrying the join code, not the bare code.
- [x] 4.2 Add an e2e that follows the encoded link and lands on the participant app's joining screen with the code already entered and the places listed.
- [x] 4.3 Re-run the existing scannable-code e2e set unchanged — accessible name, Spanish, dark theme, keyboard, hide/show, revealed contest — since the specs deliberately keep all of that true.
- [x] 4.4 Re-run the 200% zoom check on a 375px viewport and confirm it still passes at the denser symbol (~29×29 rather than ~21×21); if it does not, fix the sizing rather than the assertion.

## 5. Verification and close-out

- [x] 5.1 Full local gate: unit tests, the whole vitest run, typecheck, lint, and `openspec validate --strict` on this change.
- [x] 5.2 Live smoke test by hand: seed a contest, open the panel, show the code, decode it, and follow it into the participant app in the browser.
- [x] 5.3 Note in the change's docs that a locally-run QR points at `localhost:5174` and will not resolve from a phone — the documented consequence of the dev default, not a defect.
- [ ] 5.4 Open the PR for the slice, then sync and archive the change once it has landed.
