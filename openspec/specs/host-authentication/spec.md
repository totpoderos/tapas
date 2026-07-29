# host-authentication Specification

## Purpose
TBD - created by archiving change tapas-contest-app. Update Purpose after archive.
## Requirements
### Requirement: A login failure is refused generically, without revealing which part was wrong
A wrong password and an unknown email SHALL be refused with the same generic error, so no one can distinguish which one it was (no user enumeration — OWASP A07/A04).

#### Scenario: Logging in with the wrong password is refused
- **WHEN** a registered host with email "ana@example.com" tries to log in with the wrong password
- **THEN** logging in is refused as invalid credentials

#### Scenario: Logging in with an unknown email is refused the same way
- **WHEN** someone tries to log in with the unregistered email "nobody@example.com"
- **THEN** logging in is refused as invalid credentials

### Requirement: The account locks after repeated failed logins
An account SHALL lock after 5 failed login attempts, refusing even the correct password until the lock expires.

#### Scenario: The account locks after repeated failures
- **WHEN** a registered host with email "ana@example.com" fails to log in 5 times
- **THEN** logging in is locked, even with the correct password

### Requirement: A session lets a host do protected work over the API
Signing in SHALL grant a session that authorizes subsequent requests. Protected work SHALL be refused when no one is signed in.

#### Scenario: A host signs in and receives a session
- **WHEN** a host registers and signs in through the API as "ana@example.com"
- **THEN** the API grants a session

#### Scenario: A signed-in host can do protected work
- **WHEN** a signed-in host "ana@example.com" creates a draft through the API
- **THEN** the draft is created

#### Scenario: Protected work is refused when no one is signed in
- **WHEN** a draft is requested through the API with no one signed in
- **THEN** the API refuses it as not signed in

### Requirement: A host may only act on their own work
A signed-in host's session SHALL NOT authorize access to another host's work.

#### Scenario: A host cannot act on another host's work
- **WHEN** a second signed-in host "bob@example.com" tries to read a draft owned by signed-in host "ana@example.com"
- **THEN** the API refuses it as not allowed

### Requirement: A session can be refreshed, and a used-up refresh cannot be replayed
A host SHALL be able to refresh a session whose access token has aged out, receiving a fresh session. A refresh token, once used, SHALL NOT be usable again.

#### Scenario: A host refreshes a session that has aged out
- **WHEN** a signed-in host "ana@example.com" whose session has aged out refreshes the session through the API
- **THEN** the API grants a fresh session
- **AND** protected work is allowed again

#### Scenario: A used-up refresh cannot be replayed
- **WHEN** a signed-in host "ana@example.com" whose session has aged out refreshes the session, and someone then tries to refresh again with the old, already-used session
- **THEN** the API refuses it as not signed in

### Requirement: Signing out ends the session
Signing out SHALL end the session outright — not merely until the access token's natural expiry.

#### Scenario: Signing out ends the session
- **WHEN** a signed-in host "ana@example.com" signs out through the API
- **THEN** the former session no longer allows protected work

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

