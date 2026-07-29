# host-access-tokens Specification

## Purpose
TBD - created by archiving change tapas-contest-app. Update Purpose after archive.
## Requirements
### Requirement: A signed-in host can issue a personal access token
A signed-in host SHALL be able to issue a personal access token for an external client to use on their behalf.

#### Scenario: A signed-in host issues a personal access token
- **WHEN** a signed-in host "ana@example.com" issues a personal access token
- **THEN** a usable token is returned

### Requirement: Issuing a token requires being signed in
Issuing a personal access token SHALL require an existing session; it SHALL NOT be possible to bootstrap a token anonymously.

#### Scenario: Issuing a token requires being signed in
- **WHEN** someone with no one signed in tries to issue a personal access token
- **THEN** access is refused as not signed in

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

### Requirement: A revoked token no longer works
Once a host revokes a personal access token, it SHALL no longer authorize any request.

#### Scenario: A revoked token no longer works
- **WHEN** a signed-in host "ana@example.com" who has issued a personal access token revokes that token, and an external client then tries to use the revoked token
- **THEN** access is refused as not signed in

### Requirement: A host may only revoke their own token
Revoking a personal access token SHALL be refused if it does not belong to the requesting host (OWASP A01 — ownership).

#### Scenario: A host cannot revoke another host's token
- **WHEN** a signed-in host "ana@example.com" who has issued a personal access token, and a second signed-in host "bob@example.com", has "bob@example.com" try to revoke ana's token
- **THEN** access is refused as not allowed

