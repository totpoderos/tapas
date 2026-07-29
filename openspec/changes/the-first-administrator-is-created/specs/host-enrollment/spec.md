## MODIFIED Requirements

### Requirement: Accepting creates a host account for the invited address
Accepting an invitation with a password that meets the policy SHALL create an
account for the address the invitation was sent to, and SHALL mark the
invitation accepted. An invitation issued by an administrator SHALL produce an
ordinary host and never another administrator — the only invitation that
produces an administrator is the one that claims an unclaimed deployment.

#### Scenario: The invited person becomes a host and can sign in
- **WHEN** the invited person accepts their invitation with a strong password
- **THEN** a host account exists for the invited address
- **AND** that person can sign in with that address and password

#### Scenario: An invitation from an administrator never produces another administrator
- **WHEN** an administrator invites someone and that person accepts with a strong password
- **THEN** the account created is not an administrator

#### Scenario: A resent invitation still produces an ordinary host
- **WHEN** an administrator resends an invitation and the invited person accepts with the new link
- **THEN** the account created is not an administrator

#### Scenario: Accepting does not by itself sign the person in
- **WHEN** the invited person accepts their invitation with a strong password
- **THEN** no session is granted by the acceptance itself
