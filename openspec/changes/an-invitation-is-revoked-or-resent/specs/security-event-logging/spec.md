## ADDED Requirements

### Requirement: Revoking and resending an invitation are recorded
The security log SHALL record an invitation being revoked and an invitation
being resent, each attributed to the administrator who did it and stamped with
the source it came from. Both end someone's way into the system, and the log is
where an account that was nearly created leaves its only trace.

#### Scenario: Revoking an invitation is recorded
- **WHEN** an administrator revokes a pending invitation
- **THEN** the security log records that invitation revoked by that administrator

#### Scenario: Resending an invitation is recorded
- **WHEN** an administrator resends a pending invitation
- **THEN** the security log records that invitation resent by that administrator

#### Scenario: Neither record contains a link
- **WHEN** an administrator resends a pending invitation
- **THEN** no security log entry contains either invitation's link

## MODIFIED Requirements

### Requirement: A refused attempt to accept is recorded
The security log SHALL record an attempt to accept that was refused because the
link could not be used, stamped with the source it came from and noting which
of the reasons applied. Someone guessing at links is a signal, and the generic
refusal shown to them deliberately says nothing — so the log is the only place
it can be seen, and the only place a person who arrived too late, one who was
deliberately turned away, and one who followed a link an administrator has
since replaced can be told apart.

#### Scenario: A refused acceptance is recorded
- **WHEN** someone tries to accept with a link that no invitation ever had
- **THEN** the security log records a refused acceptance

#### Scenario: A refusal for an expired link is recorded as an expiry
- **WHEN** the invited person tries to accept more than 24 hours after the invitation was issued
- **THEN** the security log records a refused acceptance noting the link had expired

#### Scenario: A refusal for a revoked link is recorded as a revocation
- **WHEN** the invited person tries to accept a link whose invitation was revoked
- **THEN** the security log records a refused acceptance noting the link had been revoked

#### Scenario: A refusal for a superseded link is recorded as such
- **WHEN** the invited person tries to accept a link whose invitation was superseded by a resend
- **THEN** the security log records a refused acceptance noting the link had been superseded

#### Scenario: A refusal for an unknown link is not recorded as an expiry
- **WHEN** someone tries to accept with a link that no invitation ever had
- **THEN** the security log does not describe that refusal as an expiry
