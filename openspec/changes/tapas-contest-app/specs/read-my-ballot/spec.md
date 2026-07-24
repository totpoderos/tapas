## ADDED Requirements

### Requirement: A participant reads the ballot of what they may score
A participant who has claimed a place SHALL be able to read their ballot: the dishes open to them — with their own dish and any anti-bias exclusions already removed — together with the contest's categories, the score range that applies to them, and whether each category must be a strict ranking. The ballot is derived from the compiled constraint view, so it never offers a dish the participant may not score. Reading a ballot SHALL be refused when the requester has not claimed a place.

#### Scenario: A voter's ballot lists only the dishes open to them
- **WHEN** a participant in a per-person, couples-barred contest reads their ballot
- **THEN** their own dish is not on it
- **AND** their partner's dish is not on it
- **AND** the dishes they may score are on it, together with the categories and their score range

#### Scenario: Reading a ballot requires having claimed a place
- **WHEN** a ballot is requested with no participant token
- **THEN** it is refused as not signed in
