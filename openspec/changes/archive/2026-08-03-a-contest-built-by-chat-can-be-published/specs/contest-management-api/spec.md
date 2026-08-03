## ADDED Requirements

### Requirement: A draft's details say what it still needs before it can be published
A draft's details SHALL say what the draft still needs before it can be published — what kind of contest it is, who is taking part, how it is scored — naming each thing that is absent, wherever those details are read. A draft that needs nothing SHALL say nothing, and a contest that is already live SHALL say nothing, because there is nothing left for the host to do about it.

This is the same judgement publishing makes, answered before the host tries. It
SHALL agree with publishing: nothing a draft's details call ready may then be
refused as incomplete, and nothing they call still needed may then publish.

#### Scenario: A draft that has not said what kind of contest it is says so
- **WHEN** a host asks for the details of their draft that is judged on "Taste", has Ana and Bob taking part, and has not said what kind of contest it is
- **THEN** the details say it still needs what kind of contest it is

#### Scenario: A draft short of more than one thing names each of them
- **WHEN** a host asks for the details of their draft that has said nothing about what kind of contest it is nor how it is scored
- **THEN** the details say it still needs both

#### Scenario: A draft that is ready to publish says nothing is needed
- **WHEN** a host asks for the details of a draft that says what kind of contest it is, who is taking part, and how it is scored
- **THEN** the details say nothing is still needed

#### Scenario: A live contest is not told what it still needs
- **WHEN** a host asks for the details of a contest that is already live
- **THEN** the details say nothing is still needed
