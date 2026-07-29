## ADDED Requirements

### Requirement: There is no way to create an account without an invitation
The system SHALL offer no way for anybody to create a host account for
themselves. An account SHALL come into existence only by accepting an
invitation, and the first one only by claiming an unclaimed deployment — so
that every account in a deployment can be traced to somebody who allowed it.

#### Scenario: Nobody can register
- **WHEN** someone tries to create a host account for themselves, however they ask
- **THEN** there is no such thing to reach

#### Scenario: The host app offers no way to sign up
- **WHEN** someone opens the host app with no account
- **THEN** they are offered a way to sign in, and no way to create an account

## MODIFIED Requirements

### Requirement: A host has an account and can log in
A host SHALL be able to log in with the email and password of their account to
receive a session. The password SHALL never be stored in the clear, however
that account came to exist.

#### Scenario: A host with an account can log in
- **WHEN** a host with an account for "ana@example.com" logs in with that email and password
- **THEN** a session is issued

#### Scenario: The password is never stored in the clear
- **WHEN** a host has an account for "ana@example.com"
- **THEN** the stored credentials do not reveal the password

## REMOVED Requirements

### Requirement: Registration is refused for a taken email or a weak password
**Reason**: Nothing registers any more, so this requirement has nothing left to
govern. Neither rule is gone — both moved with the act they belong to.

**Migration**: The password policy is enforced when an invitation is accepted,
and refusing an address that already has an account happens when an invitation
is issued, so the refusal reaches the administrator who can act on it rather
than the invited person at the end of their journey. Both are requirements of
`host-enrollment`, with their own scenarios.
