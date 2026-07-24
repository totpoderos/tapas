## ADDED Requirements

### Requirement: A signed-in host directs their contest by chatting with the assistant
A signed-in host SHALL be able to send the assistant a message in plain language and have it either ask for clarification, carry out a reversible action on their behalf, or report what it did. The assistant SHALL act strictly as that host — every action it takes is subject to the same ownership and validation rules as if the host did it directly — and chatting SHALL be refused when no one is signed in. This is the in-app conversation, distinct from an external assistant connected by a personal access token (design.md §7).

#### Scenario: The assistant asks for detail when a request is ambiguous
- **WHEN** a signed-in host asks the assistant for something it cannot act on without more detail
- **THEN** the assistant replies asking them to clarify
- **AND** nothing about their contest changes

#### Scenario: The assistant carries out a reversible action and reports it
- **WHEN** a signed-in host asks the assistant to start a new draft with a given name
- **THEN** a draft with that name is saved for them
- **AND** the assistant reports that it did so

#### Scenario: Chatting with the assistant requires being signed in
- **WHEN** a message is sent to the assistant with no one signed in
- **THEN** it is refused as not signed in

### Requirement: The in-app assistant confirms a destructive action before carrying it out
A destructive action requested through the in-app assistant (such as closing a contest) SHALL NOT be carried out on the first request; instead the host SHALL be given a confirmation for that exact action to send back, and only a request carrying the matching confirmation SHALL carry it out. A confirmation SHALL authorise only the action it was issued for, and MUST NOT authorise a different action.

#### Scenario: A destructive action is not carried out until the host confirms
- **WHEN** a signed-in host asks the assistant to close one of their running contests
- **THEN** the contest is not closed
- **AND** the assistant asks the host to confirm closing it

#### Scenario: Confirming carries out the destructive action
- **WHEN** the host confirms closing the contest with the confirmation they were given
- **THEN** the contest is closed

#### Scenario: A confirmation authorises only the action it was given for
- **WHEN** a confirmation issued for closing one contest is used to try to close a different contest
- **THEN** the different contest is not closed
- **AND** the host is asked to confirm that action instead
