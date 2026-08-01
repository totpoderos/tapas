## Context

`dishNaming` already resolves both halves of this. It answers `nameOf` from the submitted dishes and `cooksOf` from the **materialized** dish — the roster slot that exists whether or not anyone submitted anything — which is why an unsubmitted dish already knows whose it was. The fallback simply never used the answer sitting next to it.

## Decisions

### The name of a dish nobody named is its cook's name, not a phrase about its cook

"Marta", not "Marta's dish" and not "Sin nombre". A person's name is data: `internationalization` already requires that what people typed is never translated, so a name is the one string that cannot arrive in the wrong language. Any phrase — possessive, descriptive, apologetic — has to be worded in English and Spanish, and worded again for every language added later. That is the defect being fixed, reintroduced one layer down.

It also reads better. On a leaderboard of dish names, "Marta" is a row that makes sense; "A dish" is a row that raises a question.

### One naming function, including the ballot

The ballot built its own `names` map and its own placeholder. Two paths that describe the same dish and agree by convention are this repo's recurring defect, and this one had already diverged: the reveal said `A dish`, the ballot said `A dish (not named yet)`. `GetBallot` takes the roster and goes through `dishNaming` like both reveal routes do, so there is one place left where the question is answered.

### The last resort is an em-dash

A dish can have no submitted name **and** no resolvable cook — a slot whose participant is not on the roster. There is genuinely nothing to call it. `—` carries no language and needs no translation, and it is a row nobody can act on either way. This is the only fallback that remains, and it is unreachable with consistent data.

### Cooks join with `&`, matching what the reveal already prints

`RevealView` already renders `cooks.join(' & ')` for its "brought by" line. The API joins the same way rather than inventing a second convention, so a couple's unnamed dish reads the same wherever it appears.

### The reveal stops naming the cook twice

Once an unnamed winning dish is called "Marta", the line beneath it saying "brought by Marta" is the same fact twice. The participant reveal suppresses the cook line when it would exactly repeat the headline. This is app-side: the API's answer is correct either way, and it is the drawing that would look silly.

## Risks / Trade-offs

**A cook who did not name their dish is now named on the leaderboard.** This is not a new disclosure — a voter can already list every dish with its `submitterIds`, and the roster is public to anyone with the join code, so "the place with no dish" is derivable by subtraction today. It does make an existing disclosure legible rather than derivable, which is a real difference in practice even when it is not one in principle. Flagged for the pending security review of the participant app's disclosures; that review is the right place to decide it, not this change.

**It cannot be mistaken for a dish name.** "Marta" on a leaderboard beside "Croquetas de jamón" reads as a person, which is exactly what it is: nobody said what they brought, so the only true thing to say is whose it is.
