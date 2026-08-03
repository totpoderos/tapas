## ADDED Requirements

### Requirement: A draft whose categories are not distinct things cannot be published

A draft in which two scoring categories share an identity SHALL be rejected at
publish time. No contest SHALL be created.

This is the sibling of the rule that refuses a draft in which two participants
share one, and it is refused for the same reason: a score is kept against the
category it was given for, and a total is gathered by matching it. Two categories
that are one thing underneath would each gather the other's scores, so every
total would be wrong — and nothing between publishing and the reveal would look
wrong. A contest that announces a winner decided by doubled scores is worse than
one that refuses to start, so this is caught where the rules are compiled, once,
rather than trusted to whoever wrote the draft.

The rejection SHALL say that two of the things being judged on are the same one,
so the host can act on it.

#### Scenario: A draft judged on two categories that are one thing cannot be published

- **WHEN** a host tries to publish a draft that is judged on two things which are the same one underneath
- **THEN** publishing is rejected because two of the things it is judged on are the same
- **AND** no contest is created

#### Scenario: A draft judged on distinct categories publishes

- **WHEN** a host publishes an otherwise complete draft judged on two distinct things
- **THEN** the draft becomes a live contest judged on both of them
