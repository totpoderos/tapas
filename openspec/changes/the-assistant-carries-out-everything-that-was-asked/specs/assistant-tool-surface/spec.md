## MODIFIED Requirements

### Requirement: The host can direct their contest in plain language through the assistant

The host SHALL be able to tell the assistant, in plain language, what they want
to do with their contest, and the assistant SHALL work out which actions to take
from the tools available and propose them. A request that asks for several things
SHALL be proposed as several actions, in the order the host asked for them, and
every one of them SHALL be carried out — proposing a chain and running only its
first action reports a fragment of the answer as though it were the whole. When a
request is ambiguous or missing something a tool needs, the assistant SHALL ask
the host to clarify rather than guess an action. The assistant only proposes an
action; carrying it out — and confirming anything destructive — happens through
the tools themselves.

#### Scenario: The assistant proposes an action for a clear request

- **WHEN** the host asks the assistant, in plain language, to close their contest
- **THEN** the assistant proposes closing that contest

#### Scenario: The assistant proposes every action a request asks for

- **WHEN** the host asks the assistant, in one message, for several things at once
- **THEN** the assistant proposes an action for each of them, in the order they were asked for
- **AND** every one of them is carried out

#### Scenario: The assistant asks for clarification when a request is ambiguous

- **WHEN** the host asks for something the assistant cannot act on without more detail
- **THEN** the assistant asks the host to clarify instead of proposing an action
