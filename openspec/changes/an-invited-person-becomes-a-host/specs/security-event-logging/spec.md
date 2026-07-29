## ADDED Requirements

### Requirement: The life of an invitation is recorded
The security log SHALL record an invitation being issued and being accepted,
each stamped with the source it came from, and the issuing recorded against the
administrator who issued it. An invitation is the route by which a host account
comes into existence, so this is the audit trail for account creation itself
(OWASP A09).

#### Scenario: Issuing an invitation is recorded
- **WHEN** an administrator invites "nuevo@example.com"
- **THEN** the security log records an invitation issued by that administrator

#### Scenario: Accepting an invitation is recorded
- **WHEN** the invited person accepts their invitation with a strong password
- **THEN** the security log records the invitation accepted

### Requirement: A refused attempt to accept is recorded
The security log SHALL record an attempt to accept that was refused because the
link could not be used, stamped with the source it came from. Someone guessing
at links is a signal, and the generic refusal shown to them deliberately says
nothing — so the log is the only place it can be seen.

#### Scenario: A refused acceptance is recorded
- **WHEN** someone tries to accept with a link that no invitation ever had
- **THEN** the security log records a refused acceptance

### Requirement: The security log never stores an invitation link
The security log SHALL NOT contain an invitation link or its token, in the same
way it never contains a password or a full personal access token.

#### Scenario: The security log never stores the link
- **WHEN** an administrator invites "nuevo@example.com"
- **THEN** no security log entry contains that invitation's link
