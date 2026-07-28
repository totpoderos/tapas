# clear-the-assistant-conversation Specification

## Purpose
TBD - created by archiving change clear-the-assistant-conversation. Update Purpose after archive.
## Requirements
### Requirement: A host clears the assistant conversation

A host SHALL be able to clear the conversation in the assistant panel. Clearing SHALL empty everything the conversation consists of: what is shown on the screen, the record of the exchange the assistant is given on later turns, and whatever is kept so the conversation survives leaving the panel and coming back. After clearing, the panel SHALL be as it is for a host opening the assistant for the first time, and the host SHALL be able to start a new conversation immediately.

Clearing SHALL take effect at once, without asking the host to confirm.

#### Scenario: The conversation is cleared from the screen

- **WHEN** a host who has been talking to the assistant clears the conversation
- **THEN** nothing from the exchange remains on the screen

#### Scenario: The assistant is not told what was cleared

- **WHEN** a host clears the conversation and then asks the assistant something new
- **THEN** the assistant is given only the new exchange, not what came before it

#### Scenario: A cleared conversation does not come back

- **WHEN** a host clears the conversation, leaves the assistant for another screen, and returns
- **THEN** the conversation is still empty

#### Scenario: The host can carry straight on

- **WHEN** a host clears the conversation and asks something new
- **THEN** the assistant answers, and the new exchange is the whole conversation

### Requirement: Clearing says what it did, and offers nothing to clear when empty

Clearing SHALL be announced, so that a host who cannot see the screen is told the conversation was cleared rather than being left with silence where a conversation was. The means of clearing SHALL be unavailable while there is no conversation to clear, rather than appearing to do nothing when used.

#### Scenario: Clearing is announced

- **WHEN** a host clears a conversation
- **THEN** they are told that the conversation was cleared

#### Scenario: Nothing to clear

- **WHEN** a host opens the assistant and has said nothing yet
- **THEN** clearing is not offered as something they can do

#### Scenario: Clearing becomes available once there is something to clear

- **WHEN** a host sends their first message to the assistant
- **THEN** clearing becomes available

### Requirement: An action awaiting approval cannot be cleared out from under itself

While the assistant is waiting for the host to approve a destructive action, clearing SHALL NOT be reachable: the host settles the action first, by approving or dismissing it. Should the conversation be cleared regardless, the action SHALL be cancelled and SHALL NOT be carried out — a host SHALL never be left with an approval outstanding for an action whose context has been cleared away.

#### Scenario: Clearing is out of reach while an approval is waiting

- **WHEN** the assistant is waiting for the host to approve a destructive action
- **THEN** clearing the conversation is not available until that action is settled

#### Scenario: Clearing cancels an action still awaiting approval

- **WHEN** the conversation is cleared while a destructive action awaits approval
- **THEN** the action is not carried out, and nothing is left waiting for approval

#### Scenario: What the assistant already did is not undone

- **WHEN** a host clears the conversation after the assistant has carried out an action
- **THEN** the action stands, and the record of it having happened is unaffected

