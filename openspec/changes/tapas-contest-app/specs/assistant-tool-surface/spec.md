## ADDED Requirements

### Requirement: A host can read a contest through a connected assistant
A host SHALL be able to connect an assistant (or any external client) to their
account with a personal access token and have it read their contests on their
behalf. The assistant SHALL act strictly as that host: it may read only contests
the host owns, and only while the token is valid. The assistant makes no
authorization decision of its own — it carries the host's request and identity
through, and the account's own ownership rules govern what comes back
(design.md §6.3). A contest the host owns is returned; a contest owned by another
host is refused as not allowed; without a valid token the request is refused as
not authorized.

#### Scenario: The assistant reads a contest the host owns
- **WHEN** a host asks a connected assistant to read one of their own contests, using their personal access token
- **THEN** the contest is returned

#### Scenario: The assistant cannot read a contest the host does not own
- **WHEN** a host asks a connected assistant to read a contest owned by a different host, using their own token
- **THEN** the request is refused as not allowed

#### Scenario: Without a valid token the assistant cannot read a contest
- **WHEN** a connected assistant is asked to read a contest without a valid personal access token
- **THEN** the request is refused as not authorized
