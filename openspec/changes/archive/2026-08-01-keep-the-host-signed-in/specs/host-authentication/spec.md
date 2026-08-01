## ADDED Requirements

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
