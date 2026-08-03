## ADDED Requirements

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
