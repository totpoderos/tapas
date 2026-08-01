# read-my-ballot Specification

## Purpose
TBD - created by archiving change tapas-contest-app. Update Purpose after archive.
## Requirements
### Requirement: A participant reads the ballot of what they may score

A participant who has claimed a place SHALL be able to read their ballot: the dishes open to them — with their own dish and any anti-bias exclusions already removed — together with the contest's categories, the score range that applies to them, and whether each category must be a strict ranking. The ballot is derived from the compiled constraint view, so it never offers a dish the participant may not score. Reading a ballot SHALL be refused when the requester has not claimed a place.

A dish SHALL be called on the ballot exactly what it is called in the results — including a dish nobody named, which SHALL be called by the name of the cook whose it is. A participant scores a dish on one screen and reads its total on another; a dish that changes its name in between is a dish they cannot follow.

#### Scenario: A voter's ballot lists only the dishes open to them

- **WHEN** a participant in a per-person, couples-barred contest reads their ballot
- **THEN** their own dish is not on it
- **AND** their partner's dish is not on it
- **AND** the dishes they may score are on it, together with the categories and their score range

#### Scenario: A dish nobody named is called by its cook on the ballot too

- **WHEN** a participant's ballot includes a dish that was never named
- **THEN** that dish is called by the name of the cook whose it is
- **AND** it is called the same thing when the results are revealed

#### Scenario: Reading a ballot requires having claimed a place

- **WHEN** a ballot is requested with no participant token
- **THEN** it is refused as not signed in

