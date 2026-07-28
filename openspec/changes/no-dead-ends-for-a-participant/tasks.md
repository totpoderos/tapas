## 1. Letting the app know a vote has been sent

- [x] 1.1 Write the acceptance scenario first, in domain language, and confirm it before implementing: after a participant sends their vote, reading their own scores says the vote is sent; before that, it says it is still a draft
- [x] 1.2 Watch it fail against today's reply — both new assertions failed on `status` being undefined while the other 27 scenarios passed, confirming the gap rather than describing it
- [x] 1.3 Report the vote's own draft-or-sent state alongside a participant's scores, taken from what is recorded rather than inferred
- [x] 1.4 Carry it through to the participant app's reading of its own scores

## 2. A sent vote reads as sent

- [x] 2.1 Show a participant returning to the scoring screen that their vote is already in, along with the scores they gave
- [x] 2.2 Make sure nothing on that screen offers to change a score or send the vote again — the API already refuses both, so this is about not offering what cannot happen
- [x] 2.3 Keep a draft vote fully editable, and keep sending working exactly as it does today
- [x] 2.4 Give the sent wording its translations in English and Spanish
- [x] 2.5 Cover it with component tests including an accessibility scan: sent, still-draft, and that a reload does not change which is shown

## 3. No screen without a way onward

- [x] 3.1 Decide from where a participant is which steps are open to them, in one place, so a screen cannot forget one
- [x] 3.2 Offer those steps on the scoring screen, the results screen — **including while it waits for the reveal**, which is where a participant spends longest with nothing on the page — and the dish form
- [x] 3.3 Keep it compact: this is the mobile-first app, one column at ≤460px, and the reflow check at 320px has to keep passing
- [x] 3.4 Give the new wording its translations in English and Spanish
- [x] 3.5 Cover it with component tests including an accessibility scan, asserting per screen exactly which ways onward are expected

## 4. Arriving the ways nobody tests

- [x] 4.1 Add whole-system coverage for the journeys that caused this: reaching a screen by the **browser's back button**, by a **reload**, and by **typing the address** — every existing scenario walks forward by following links, which is why this shipped
- [x] 4.2 Cover the reported journey end to end: send a vote, open the results, go back, and reach the results again from the scoring screen
- [x] 4.3 Run it in both browsers, since the participant app is the mobile-first one
- [x] 4.4 Check that going back is respected and nobody is sent onward without asking — the behaviour chosen over an automatic redirect

## 5. Verifying

- [x] 5.1 Run the full verification: unit and acceptance tests, the whole-system tests in both browsers, typecheck, lint, the supply-chain gate, and `openspec validate --strict`
- [x] 5.2 Walk it by hand against the running stack, using the back button — confirmed the two dead ends are gone, that going back shows the vote as sent and does not offer a re-send, and that a reload changes nothing. **It also showed a redundancy the tests could not judge:** the existing one-off links (`Score the dishes →`, `See the results →`) now sit alongside the same destinations in the new nav. Left in place rather than removed unilaterally — the prominent call to action still carries the forward flow — but it is a real cost on a 320px screen and worth a decision
