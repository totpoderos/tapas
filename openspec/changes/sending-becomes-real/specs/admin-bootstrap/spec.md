## ADDED Requirements

### Requirement: A claim whose message cannot be sent is not silently lost
A claim SHALL stand even when its message cannot be handed off, and whoever
claimed SHALL be told that it did not go out and offered the link in that
answer. A first-run deployment has no administrator to resend anything, so a
claim that failed quietly would leave it unclaimable until its invitation ran
out of time.

#### Scenario: A claim survives a message that could not be sent
- **WHEN** the configured address claims a deployment and the message cannot be handed off
- **THEN** the claim stands
- **AND** the link is offered in that answer

#### Scenario: The claim can still be accepted
- **WHEN** the configured address claims a deployment, the message cannot be handed off, and the link from that answer is used
- **THEN** an administrator account exists for the configured address

#### Scenario: Claiming is not reported as having failed
- **WHEN** the configured address claims a deployment and the message cannot be handed off
- **THEN** claiming is not refused
