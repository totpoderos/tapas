# converse-with-the-host-assistant Specification

## Purpose
TBD - created by archiving change tapas-contest-app. Update Purpose after archive.
## Requirements
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

### Requirement: The panel asks which contest is meant whenever a name is shared

The panel SHALL ask which contest is meant whenever a host names one that more
than one of their contests bears, showing the candidates and changing nothing
until the host says. This SHALL hold for every action the assistant can take,
not only for reading — a host who has reused a name must be able to close,
publish, reveal, delete or edit the right one without ever seeing an internal
id.

A name that matches none of the host's contests SHALL be reported plainly as
matching nothing, distinctly from an action that was attempted and failed, so a
host can tell a mistyped name from a refused change.

#### Scenario: The panel offers the choice when a name is shared

- **WHEN** a signed-in host asks the assistant to act on a name two of their contests share
- **THEN** the panel shows both contests and asks which one is meant
- **AND** neither contest is changed

#### Scenario: The panel says plainly when a name matches nothing

- **WHEN** a signed-in host asks the assistant to act on a name none of their contests has
- **THEN** the panel says no contest has that name
- **AND** it does not read as an action that failed

### Requirement: The panel says in words what the assistant changed about a draft

The panel SHALL say what a rule change did in the host's own terms — what the
draft is now judged on, what kind of contest it now is, how it is now scored,
who is now partnered with whom — rather than echoing the call that was made. A
host reads the panel to know the state of their contest, so what it reports
SHALL be the state the change produced.

A refused change SHALL be shown as a refusal carrying its reason, and SHALL NOT
be shown in the same way as a change that succeeded.

#### Scenario: The panel reports a rule the assistant changed

- **WHEN** a signed-in host asks the assistant to add a scoring category to one of their drafts
- **THEN** the panel reports what the draft is now judged on

#### Scenario: The panel shows a refused change as a refusal, with its reason

- **WHEN** a signed-in host asks the assistant for a change to a draft that cannot stand
- **THEN** the panel shows it as refused and gives the reason
- **AND** the draft is unchanged

#### Scenario: A destructive edit is confirmed before it is carried out

- **WHEN** a signed-in host asks the assistant to remove a scoring category from one of their drafts
- **THEN** the draft is still judged on that category
- **AND** the assistant asks the host to confirm removing it

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

### Requirement: A destructive action ends the run and is approved on its own

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

### Requirement: A step that fails ends the run, and the panel says where it got to

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

### Requirement: The panel says what a draft still needs before it can be published
The panel SHALL say what a draft still needs before it can be published whenever the assistant has just changed that draft, naming each thing the draft has not said. A host who has just built a contest by chat SHALL read what is left to do at the point they can still do it, rather than meeting it for the first time as a refusal.

What is still needed SHALL be said in the host's own terms — what kind of
contest it is, who is taking part, how it is scored — and SHALL be shown as
something left to say, not as a step that failed. A draft that needs nothing
SHALL be shown exactly as it is shown now: an unfinished draft and a ready one
must not read alike, and a ready one must not carry an empty warning.

#### Scenario: A draft built in one message says what it still needs

- **WHEN** a signed-in host asks the assistant, in one message, to create a contest judged on two things with three people taking part and a score range, without saying what kind of contest it is
- **THEN** every one of those things is carried out
- **AND** the panel says the contest still needs what kind of contest it is

#### Scenario: Saying the missing thing leaves nothing still needed

- **WHEN** a host whose draft only lacks what kind of contest it is tells the assistant everyone is on their own
- **THEN** the panel reports what kind of contest it now is
- **AND** the panel does not say anything is still needed

#### Scenario: A draft that is ready carries no warning

- **WHEN** a signed-in host asks the assistant to change a draft that says what kind of contest it is, who is taking part and how it is scored
- **THEN** the panel reports the change
- **AND** the panel does not say anything is still needed

### Requirement: The host is asked what kind of contest it is rather than having it chosen for them
The host SHALL be asked for anything a draft still needs to be published — what kind of contest it is above all — and it SHALL NOT be chosen for them. A host who never says what kind of contest they are running SHALL be asked in plain words that name the kinds they can choose between, once everything else they asked for has been carried out.

Asking SHALL NOT cost the host the rest of their message: everything asked for is
carried out first, and the question comes after. A message that leaves something
unsaid is not a message that could not be understood.

The question SHALL be asked whether or not the assistant says anything of its
own. What a host is asked cannot depend on a model choosing to speak: a question
that appears only sometimes is one a host may never be asked, which is the defect
this exists to close.

#### Scenario: A setup message that leaves the kind of contest unsaid is still carried out

- **WHEN** a signed-in host asks the assistant to set up a contest with categories and people, saying nothing about what kind of contest it is
- **THEN** the contest is created with those categories and people
- **AND** the host is asked what kind of contest it is

#### Scenario: The question names the kinds a host can choose between

- **WHEN** a host is asked what kind of contest theirs is
- **THEN** the three kinds are named in plain words

#### Scenario: The kind of contest is never settled on the host's behalf

- **WHEN** a signed-in host sets up a contest by chat without saying what kind of contest it is
- **THEN** the draft does not say what kind of contest it is
