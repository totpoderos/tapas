# validate-and-publish-contest Specification

## Purpose
TBD - created by archiving change tapas-contest-app. Update Purpose after archive.
## Requirements
### Requirement: A host publishes a complete draft
Publishing a complete draft SHALL compile its rule-space configuration into a materialized constraint view, issue a join code, retire the draft, and turn it into a live contest. The publish SHALL be recorded in the audit log.

#### Scenario: A host publishes a complete draft
- **WHEN** a host with a complete draft named "Summer Tapas 2026" for 4 people in 2 couples, scored per person with couples barred, publishes the draft
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
- **WHEN** a host with a draft for a single couple, scored per person with couples barred, tries to publish the draft
- **THEN** publishing is rejected because a judge could score nothing
- **AND** no contest is created

### Requirement: Only the owning host may publish a draft
Publishing SHALL be refused for a draft that does not belong to the requesting host (OWASP A01 — ownership).

#### Scenario: A host cannot publish another host's draft
- **WHEN** a host with a complete draft named "Summer Tapas 2026" for 4 people in 2 couples, scored per person with couples barred, and a different host tries to publish that draft
- **THEN** publishing is rejected because the draft is not theirs

### Requirement: Each published contest gets its own join code
Every contest published from a distinct draft SHALL receive a distinct join code.

#### Scenario: Each published contest gets its own join code
- **WHEN** a host with two complete drafts publishes both
- **THEN** the two contests have different join codes

