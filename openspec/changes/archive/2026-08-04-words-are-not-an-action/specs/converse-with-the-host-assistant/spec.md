## ADDED Requirements

### Requirement: The panel says when the assistant only answered in words

The panel SHALL say that nothing was changed whenever the assistant answers a host in words without carrying anything out, in its own voice and distinctly from the assistant's own words, including when the answer is plainly a question.

The assistant answering and the assistant acting are two different events, and
only one of them changes a contest. The panel knows which of the two happened;
the host cannot tell from reading the answer, and a model that reports work it
has not done is telling them something untrue in their own app. Where the words
claim otherwise, what the panel says SHALL stand as the account of what happened.

Said every time, not only where the words look like a claim: a statement that
appears sometimes teaches a reader to draw conclusions from its absence, and
telling apart a claim of completion from a question is a judgement about prose
that no panel can make reliably.

#### Scenario: The assistant asks for more detail

- **WHEN** the assistant answers a host by asking which contest they mean
- **THEN** the panel says that nothing was changed

#### Scenario: The assistant claims to have done something it did not do

- **WHEN** the assistant answers a host in words saying it has created a contest, without carrying anything out
- **THEN** the panel says that nothing was changed
- **AND** the host has no more contests than before

#### Scenario: An action that was carried out is not called nothing

- **WHEN** the assistant carries out an action a host asked for
- **THEN** the panel says what it did
- **AND** the panel does not say that nothing was changed
