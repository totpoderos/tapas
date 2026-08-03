## MODIFIED Requirements

### Requirement: Sensitive entry points are rate-limited
Signing in and joining a contest by its code SHALL be throttled against rapid repeated attempts from the same source, on top of (not instead of) any account lockout. Ordinary traffic SHALL NOT be throttled.

The count SHALL be a property of the deployment rather than of whichever process
answered. Attempts from one source SHALL be counted together however many
instances are serving, and SHALL NOT begin again because a new one started. A
limit that counts separately in each process is not the limit it says it is, and
nothing about a request or a log would reveal the difference.

When the count cannot be read, the attempt SHALL be refused rather than allowed.
A control whose failure lets the thing through is not a control, and this one
guards the two entry points an attacker reaches for first.

#### Scenario: Repeated rapid login attempts are throttled

- **WHEN** many login attempts arrive in rapid succession from the same source
- **THEN** further attempts are refused as too many requests

#### Scenario: Repeated rapid join attempts are throttled

- **WHEN** many attempts to join a contest arrive in rapid succession from the same source
- **THEN** further attempts are refused as too many requests

#### Scenario: Ordinary traffic is not throttled

- **WHEN** a handful of requests are made well within the limit
- **THEN** each is handled normally

#### Scenario: Attempts spread across instances are counted together

- **WHEN** attempts from one source arrive at more than one instance of the same deployment
- **THEN** they count towards one limit, and the source is refused as though they had all arrived at one

#### Scenario: A newly started instance does not reset the count

- **WHEN** a source has spent its attempts and an instance starts afresh
- **THEN** that source is still refused

#### Scenario: A count that cannot be read refuses the attempt

- **WHEN** the record of attempts cannot be read
- **THEN** the attempt is refused rather than allowed

#### Scenario: A source that waited is served again

- **WHEN** a source that spent its attempts waits out the window
- **THEN** it is served again
