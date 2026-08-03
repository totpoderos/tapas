## ADDED Requirements

### Requirement: A deployment says which database serves it
A deployment SHALL say which database serves it, as configuration, alongside the other choices it makes about how it is run. A deployment that says nothing SHALL be served by the one that needs nothing installed, so that running the app for the first time still requires no setup.

A value that names neither database SHALL be refused when the deployment starts,
not when it first reads or writes. A deployment that cannot store anything is not
a deployment, and it must not be discovered to be one under load.

#### Scenario: A deployment names the database it wants

- **WHEN** a deployment says it is served by a database reachable over the network
- **THEN** it is served by that one

#### Scenario: A deployment that says nothing is still served

- **WHEN** a deployment says nothing about which database serves it
- **THEN** it is served by the one that needs nothing installed

#### Scenario: A deployment naming no known database refuses to start

- **WHEN** a deployment names a database that is neither of the two
- **THEN** it refuses to start, saying so

### Requirement: Both databases serve the same behaviour
Every requirement of every other capability SHALL hold whichever database serves the deployment. What a host, a participant, or an assistant can do, and what they are refused, SHALL NOT depend on where the data is kept.

This SHALL be shown rather than asserted: the acceptance specs SHALL be runnable
against either database, and passing under one is not evidence about the other.
Two ways of storing the same thing that are only ever exercised separately will
diverge, and the divergence will be found by a host rather than by a test.

#### Scenario: The specs pass whichever database is serving

- **WHEN** the acceptance specs are run against either database
- **THEN** they pass

#### Scenario: A contest read back is the contest that was written

- **WHEN** a host prepares and publishes a contest under either database
- **THEN** what they read back is what they wrote, in both

### Requirement: Work that must happen together still does
A change made of several writes SHALL either happen entirely or not at all, whichever database serves the deployment. A vote, a publish, or a draft edit interrupted halfway SHALL leave nothing half-written behind it.

Where a database serves many callers at once, the writes of one such change SHALL
be carried by a single conversation with it from beginning to end. Spreading them
across whichever connection happened to be free is how a half-finished change
commits.

#### Scenario: An interrupted change leaves nothing behind

- **WHEN** a change made of several writes fails partway through
- **THEN** none of its writes remain

#### Scenario: Concurrent work does not interleave

- **WHEN** two such changes are made at the same time
- **THEN** neither sees the other half-finished

### Requirement: The application does not know which database it is on
The code that reads and writes contests, votes, drafts and accounts SHALL be written once, and SHALL NOT branch on which database is serving. Differences between the two SHALL be confined to the one place that speaks to a database.

Two copies of a query are two chances to fix a bug once. This is the same rule
the assistant and the MCP server already live under, learned the same way: paths
that share a destination have to be shown to share each step, so it is cheaper to
not have two paths.

#### Scenario: One statement, either database

- **WHEN** a repository issues a statement
- **THEN** the same statement text serves both databases
