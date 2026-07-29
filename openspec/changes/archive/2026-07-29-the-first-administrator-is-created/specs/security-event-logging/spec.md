## ADDED Requirements

### Requirement: Claiming a deployment is recorded, and so is failing to
The security log SHALL record a deployment being claimed and an administrator
being created by it, and SHALL record every refused attempt to claim, stamped
with the source it came from. An attempt to claim an instance somebody else
owns is the loudest signal this system can produce, and it is refused silently
enough that the log is the only place it appears.

#### Scenario: Claiming an unclaimed deployment is recorded
- **WHEN** the configured address claims a deployment that has no administrator
- **THEN** the security log records that the deployment was claimed

#### Scenario: Becoming the administrator is recorded
- **WHEN** the configured address claims the deployment and accepts the invitation
- **THEN** the security log records that the deployment's administrator was created

#### Scenario: A claim from the wrong address is recorded
- **WHEN** an address other than the configured one tries to claim the deployment
- **THEN** the security log records a refused claim

#### Scenario: A claim on an already-claimed deployment is recorded
- **WHEN** anyone tries to claim a deployment that already has an administrator
- **THEN** the security log records a refused claim

#### Scenario: No record contains the configured address of a refused claim
- **WHEN** an address other than the configured one tries to claim the deployment
- **THEN** no security log entry reveals the configured address
