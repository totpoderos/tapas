# validate-and-publish-contest Specification

## Purpose
TBD - created by archiving change tapas-contest-app. Update Purpose after archive.
## Requirements
### Requirement: A host publishes a complete draft
Publishing a complete draft SHALL compile its rule-space configuration into a materialized constraint view, issue a join code, retire the draft, and turn it into a live contest. The publish SHALL be recorded in the audit log.

#### Scenario: A host publishes a complete draft
- **WHEN** a host with a complete draft named "Summer Tapas 2026" for 4 people in 2 couples, where everyone is on their own with partners kept apart, publishes the draft
- **THEN** the draft becomes a live contest named "Summer Tapas 2026"
- **AND** a join code is issued for the contest
- **AND** the draft no longer appears among the host's drafts
- **AND** the audit log records that the contest was published

### Requirement: An incomplete draft cannot be published
A draft missing its scoring rules SHALL be rejected at publish time. No contest SHALL be created.

#### Scenario: An incomplete draft cannot be published
- **WHEN** a host with a draft named "Half-baked" that has no scoring rules yet tries to publish the draft
- **THEN** publishing is rejected because the draft is incomplete
- **AND** no contest is created

### Requirement: A draft that would leave a judge unable to score cannot be published
A draft whose rules would leave any judge with nothing they are allowed to score SHALL be rejected at publish time. No contest SHALL be created.

#### Scenario: A draft that leaves a judge unable to score cannot be published
- **WHEN** a host with a draft for a single couple, where everyone is on their own with partners kept apart, tries to publish the draft
- **THEN** publishing is rejected because a judge could score nothing
- **AND** no contest is created

### Requirement: Only the owning host may publish a draft
Publishing SHALL be refused for a draft that does not belong to the requesting host (OWASP A01 — ownership).

#### Scenario: A host cannot publish another host's draft
- **WHEN** a host with a complete draft named "Summer Tapas 2026" for 4 people in 2 couples, where everyone is on their own with partners kept apart, and a different host tries to publish that draft
- **THEN** publishing is rejected because the draft is not theirs

### Requirement: Each published contest gets its own join code
Every contest published from a distinct draft SHALL receive a distinct join code.

#### Scenario: Each published contest gets its own join code
- **WHEN** a host with two complete drafts publishes both
- **THEN** the two contests have different join codes

### Requirement: A contest where couples cook together cannot be published while anybody has no partner

A contest whose format is that couples cook together SHALL be rejected at publish time while any participant has no partner. The format is only for couples: there is no dish for an unpartnered person to cook and no couple for them to belong to, so the contest is incomplete rather than merely unusual. The rejection SHALL say that somebody is without a partner, and no contest SHALL be created.

#### Scenario: A couples contest with an unpartnered participant cannot be published
- **WHEN** a host with a draft where couples cook together, for five people of whom four are two couples and one has no partner, tries to publish the draft
- **THEN** publishing is rejected because a participant has no partner
- **AND** no contest is created

#### Scenario: A couples contest where everybody is partnered publishes
- **WHEN** a host with a complete draft where couples cook together, for four people in two couples, publishes the draft
- **THEN** the draft becomes a live contest
- **AND** each couple has one dish between them

#### Scenario: A participant without a partner does not stop the other formats
- **WHEN** a host with a complete draft where partners are kept apart, for three people of whom two are partners, publishes the draft
- **THEN** the draft becomes a live contest
- **AND** each of the three has their own dish

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

