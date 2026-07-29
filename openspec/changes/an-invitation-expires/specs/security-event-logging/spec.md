## MODIFIED Requirements

### Requirement: A refused attempt to accept is recorded
The security log SHALL record an attempt to accept that was refused because the
link could not be used, stamped with the source it came from and noting whether
the link had expired. Someone guessing at links is a signal, and the generic
refusal shown to them deliberately says nothing — so the log is the only place
it can be seen, and the only place an expiry can be told apart from a guess.

#### Scenario: A refused acceptance is recorded
- **WHEN** someone tries to accept with a link that no invitation ever had
- **THEN** the security log records a refused acceptance

#### Scenario: A refusal for an expired link is recorded as an expiry
- **WHEN** the invited person tries to accept more than 24 hours after the invitation was issued
- **THEN** the security log records a refused acceptance noting the link had expired

#### Scenario: A refusal for an unknown link is not recorded as an expiry
- **WHEN** someone tries to accept with a link that no invitation ever had
- **THEN** the security log does not describe that refusal as an expiry
