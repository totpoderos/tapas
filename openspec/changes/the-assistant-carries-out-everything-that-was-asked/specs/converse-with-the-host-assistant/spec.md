## ADDED Requirements

### Requirement: One message may ask for several things and all of them happen

The assistant SHALL carry out every action a host's message asks for, in the
order the message asks for them, rather than the first alone. A host who writes
"create a contest called Tapas, judge it on Taste and Originality, and have
Carlos, Alba and Juan taking part" SHALL end with a contest that has all of it.

The panel SHALL report every step, in order, so the host reads back the whole of
what happened. Reporting one step as though it were the answer, while others were
asked for and not carried out, is the failure this exists to prevent.

#### Scenario: Several things asked for in one message all happen

- **WHEN** a signed-in host asks the assistant, in one message, to create a contest and add two categories and three participants to it
- **THEN** the contest exists with both categories and all three people
- **AND** the panel reports each of those steps

#### Scenario: A message asking for one thing is unchanged

- **WHEN** a signed-in host asks the assistant for a single action
- **THEN** it is carried out and reported as before

### Requirement: A destructive action ends the chain and is approved on its own

The assistant SHALL stop at the first irreversible action a message asks for:
it SHALL carry out the reversible actions that come before it, SHALL then ask
the host to confirm that one, and SHALL NOT carry out anything the message asked
for after it.

The confirmation SHALL name the one action it approves. It MUST NOT authorise
anything else the message asked for, whether or not the host has read those.

Whatever was asked for and not reached SHALL be reported, so a host knows what is
left to ask for rather than assuming the whole message was carried out.

#### Scenario: The reversible steps before an irreversible one are carried out

- **WHEN** a signed-in host asks in one message to add a category to a draft and then publish it
- **THEN** the category is added
- **AND** the host is asked to confirm publishing
- **AND** the contest is not published until they do

#### Scenario: What was asked for after an irreversible action is not carried out

- **WHEN** a signed-in host asks in one message to publish a draft and then do something else to it
- **THEN** the host is asked to confirm publishing
- **AND** the thing asked for after it has not happened
- **AND** the panel says it was not reached

### Requirement: A step that fails ends the chain, and the panel says where it got to

The assistant SHALL stop at the first action it cannot carry out: it SHALL
report that step as failed with the reason, SHALL NOT attempt anything asked for
after it, and SHALL leave what already happened as it is. The panel SHALL show which
steps were carried out, which one failed and why, and that the rest were not
attempted.

Later steps commonly depend on earlier ones, so continuing past a failure turns
one honest error into a run of confusing ones.

#### Scenario: A failing step stops the ones after it

- **WHEN** a signed-in host asks in one message for three things, and the second cannot be carried out
- **THEN** the first has happened
- **AND** the second is shown as refused, with its reason
- **AND** the third has not been attempted
