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

### Requirement: A host can read their drafts and live tallies through a connected assistant
Beyond a published contest, a host SHALL be able to have their connected
assistant read the other things that belong to them: a contest draft they are
preparing, and the live tally of a running contest (how many participants have
claimed a place, are still scoring, and have sent their votes). The same rule
holds as for every tool — the assistant acts strictly as that host, reading only
what the host owns, and deciding nothing itself.

#### Scenario: The assistant reads a draft the host owns
- **WHEN** a host asks a connected assistant to read one of their own drafts, using their personal access token
- **THEN** the draft is returned

#### Scenario: The assistant reads the live tally of the host's contest
- **WHEN** a host asks a connected assistant to read the tally of one of their own running contests, using their personal access token
- **THEN** the tally is returned

#### Scenario: The assistant cannot read a draft the host does not own
- **WHEN** a host asks a connected assistant to read a draft owned by a different host, using their own token
- **THEN** the request is refused as not allowed
