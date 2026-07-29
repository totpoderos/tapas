## MODIFIED Requirements

### Requirement: The token lets an external client act as the issuing host
A valid personal access token SHALL let an external client act with the same
identity as the issuing host, and with the authorization of a host — never with
administrative authorization, even when the issuing account is an
administrator. A token is therefore never a way to widen what its holder can
reach beyond what any host can reach.

#### Scenario: The token lets an external client act as that host
- **WHEN** a signed-in host "ana@example.com" who has issued a personal access token has an external client use that token to create a draft
- **THEN** the draft is created for that host

#### Scenario: The token of an administrator carries no administrative authority
- **WHEN** an administrator who has issued a personal access token has an external client use that token to do administrative work
- **THEN** access is refused as not allowed
