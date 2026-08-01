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

### Requirement: A host at work keeps working when their session ages out

A host using the app SHALL keep working when their session ages out, without
being asked for their password again and without losing what they were doing.
The app SHALL renew the aged-out session and carry out the work that found it
aged out. This SHALL hold for the first thing the app does after it is opened
again, so that returning to a left-open app does not send a host to sign-in.

A host SHALL still be returned to sign-in when the session cannot be renewed at
all — when it has been signed out, or has been left far longer than a session
lasts.

#### Scenario: A host carries on after their session ages out

- **WHEN** a signed-in host whose session has aged out asks the app for their
  contests
- **THEN** they are shown their contests
- **AND** they are not asked to sign in

#### Scenario: Returning to a left-open app does not send a host to sign in

- **WHEN** a signed-in host leaves the app open until their session ages out, and
  the app then asks who is signed in
- **THEN** the host is still signed in
- **AND** they are not asked to sign in

#### Scenario: A session that cannot be renewed sends the host to sign in

- **WHEN** a host whose session has aged out and cannot be renewed asks the app
  for their contests
- **THEN** they are asked to sign in

### Requirement: Work that overlaps an aged-out session renews it once

The app SHALL renew a session once on behalf of every piece of work in flight
that finds it aged out, and SHALL NOT renew it once per piece of work. Every
piece of work SHALL then be carried out.

A renewal spends the means of renewing and immediately replaces it, so a second
renewal raised at the same moment would offer something already spent, and would
end the very session it was raised to save. This requirement is what makes a
host's session survive a screen that asks for two things at once.

#### Scenario: Two overlapping pieces of work renew the session once between them

- **WHEN** a signed-in host whose session has aged out asks the app for two
  things at once
- **THEN** the session is renewed once
- **AND** both pieces of work are carried out
- **AND** the host is not asked to sign in

### Requirement: A host with the app open more than once keeps one session between them

The app SHALL renew a session one window at a time when a host has it open in
more than one, and a window that finds another has just renewed SHALL renew
nothing. No window SHALL be left signed out of work it was doing. Renewing SHALL
NOT be abandoned in a browser that offers no way to coordinate between windows.

Taking turns is not by itself enough, and the difference is worth recording
because it was found by measuring rather than by reasoning. Renewing spends the
means of renewing and replaces it, and the windows share one — so a second
renewal, even when it waits its turn and is allowed, discards what the first
window was just given and leaves that window unable to carry on. The window that
waited has to notice that the waiting was the point.

#### Scenario: A host working in two windows stays signed in

- **WHEN** a host with the app open in two windows works in both at the moment
  their session ages out
- **THEN** the session is renewed once between the two windows
- **AND** both windows carry out the work
- **AND** neither window asks them to sign in

### Requirement: Renewal is attempted once per piece of work

The app SHALL attempt to renew a session at most once on behalf of any single
piece of work. Work still refused after a renewal SHALL be reported as refused,
and SHALL NOT provoke a further renewal.

Without this, a refusal that has nothing to do with an aged-out session — the
work is not this host's to do, or the account no longer has the standing it had
— would renew and retry endlessly.

#### Scenario: Work refused again after a renewal is reported, not retried

- **WHEN** a signed-in host asks the app for something they are not allowed, and
  it is still refused after the session is renewed
- **THEN** the refusal is reported to them
- **AND** the session is not renewed a second time for it

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

