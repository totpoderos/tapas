# Tasks

One slice, one ATDD loop, one PR. The feature is written first and confirmed before any implementation, and the slice ends on the usual verification: unit tests, the full vitest run, typecheck, lint, `openspec validate`, and the screens driven live against a running app.

Carried over from `the-cook-gets-their-own-app` task 7.8, which found it and correctly declined to fix it in a slice about restyling the reveal.

## 1. The name

- [x] 1.1 Write the acceptance features for the three modified capabilities: a dish nobody named is called by its cook on the results, by both cooks where a couple brought it, by the same name on the ballot, and by the same name for the host as for the participant. Confirm them before implementing.
- [x] 1.2 Make `dishNaming.nameOf` fall back to the cooks it already resolves, joined the way `RevealView` already joins them, and to an em-dash where there is neither a name nor a cook.
- [x] 1.3 Route `GetBallot` through `dishNaming` and delete its own placeholder. It needs the roster, so its composition gains a dependency — the point is that one function now answers what a dish is called, on every read that answers it.
- [x] 1.4 Suppress the participant reveal's cook line when it would exactly repeat the headline.
- [x] 1.5 Check the same-results tests still bite. **Verified by mutation, twice.** Putting `'A dish'` back in `nameOf` failed 10 tests across all five files that touch the naming. Giving the ballot its own placeholder again — the exact drift this removes — failed 2, including the scenario that reads the same dish on the ballot and then on the reveal. Reverted; all pass.
- [x] 1.6 Check whether the MCP surface names dishes, and follow it if so. **Checked: it does not.** `get_results` is the only tool that reaches a result, and it reads `/contests/:id/results`, whose `toResultsDto` carries dish **ids** and totals with no names at all. Nothing to keep in step. Same answer as 2.3 and 6.4 of `the-cook-gets-their-own-app`, for a different reason: there the read had no MCP mirror, here the mirror exists and carries no names.
- [x] 1.7 No new translation resources. **Confirmed: neither app's locale files are touched.** The API carries one string less than it did.
- [x] 1.8 Run the slice verification. Typecheck clean, lint clean, vitest 2069/2069, Playwright 319/319 (Chromium + WebKit), `openspec validate` passing, and a contest where two cooks never named their dishes driven live **in Spanish**: the winner reads `Marta`, the third row reads `Nuria`, and there is no English on the screen. The API's three reads were checked to agree in the same run — the ballot, the participant's reveal and the host's `/winners` all call it `Marta`.

## 2. Closing out

- [x] 2.1 Note the disclosure in `the-cook-gets-their-own-app` task 9.1, so the security review of the participant app's disclosures considers this one alongside the roster of taken places and per-participant voting progress.
- [x] 2.2 Tick task 7.8 in `the-cook-gets-their-own-app` and point it here.
