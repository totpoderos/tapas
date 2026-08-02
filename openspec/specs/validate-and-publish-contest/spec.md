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

