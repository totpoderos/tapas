## ADDED Requirements

### Requirement: A refusal to publish carries the facts it is about

When publishing is refused, the refusal SHALL carry the facts it concerns — the people it names, the things being judged on it names, the bounds it objects to, the things the contest has still not said — in a form a caller can read and act on, and not only as a sentence.

A sentence is written in one language and cannot be put into another by whoever reads it. Every surface that shows a host why their contest could not go live is therefore either stuck with the language it was written in, or left to take the sentence apart. Carrying the facts is what lets the panel say the same thing in the host's language while naming the same people and the same categories.

The sentence SHALL remain, unchanged in meaning, for the callers that have no translations of their own — a connected assistant, a log, an API client.

#### Scenario: A refusal names the people it is about

- **WHEN** publishing is refused because somebody in a couples contest has no partner
- **THEN** the refusal identifies that person as a fact of the refusal, not only inside its sentence

#### Scenario: A refusal names what is still unsaid

- **WHEN** publishing is refused because the contest has not said what kind it is
- **THEN** the refusal identifies what is still unsaid as a fact of the refusal
- **AND** it still reads as a sentence for a caller that has no words of its own

### Requirement: A refusal never names an internal identifier

No refusal to publish SHALL show the host an internal identifier. A host has never been shown one and cannot act on one; a refusal that quotes an id sends them looking for something that does not appear anywhere they can see.

Where a refusal is about two things that cannot be told apart, it SHALL name them the way the host named them, so they know which two are meant.

#### Scenario: Two people who cannot be told apart are named, not identified

- **WHEN** publishing is refused because two of the people taking part cannot be told apart
- **THEN** the refusal names those two people as the host named them
- **AND** it shows no internal identifier
