Feature: A refusal to publish says what it is about
  The reason a contest cannot go live is written once and read in several places
  — the rules the host is working on, the assistant they asked, a log somebody
  reads later. A sentence can only be written in one language, so a refusal also
  carries the facts it is about: the people it names, the things being judged on
  it names, and what the contest has still not said. What is read from those
  facts is the same refusal, in whatever words the reader has.

  The sentence stays, for readers that have no words of their own. And no
  refusal quotes an id: a host has never been shown one and cannot act on one.

  Scenario: A refusal about somebody without a partner says who
    Given a host with a draft where couples cook together, for 5 people of whom 4 are 2 couples and 1 has no partner
    When the host tries to publish the draft
    Then publishing is rejected because a participant has no partner
    And the refusal says which person it is about
    And it still reads as a sentence

  Scenario: A refusal about two people who cannot be told apart names them
    Given a host with a draft in which two of the people taking part cannot be told apart
    When the host tries to publish the draft
    Then publishing is rejected because two of the people cannot be told apart
    And the refusal names those two people as the host named them
    And the refusal quotes nothing the host has never been shown

  Scenario: A refusal about two things judged on that are one thing names them
    Given a host with a draft judged on two things that cannot be told apart
    When the host tries to publish the draft
    Then the refusal names both of those things as the host named them

  Scenario: A refusal about what is still unsaid says which things
    Given a host with a draft that has only a name
    When the host tries to publish the draft
    Then publishing is rejected naming all three of the things it still needs
    And the refusal says which things are still unsaid, each on its own

  # Nothing to name, and saying so is a decision rather than something forgotten.
  Scenario: A refusal that is about nothing in particular carries no facts
    Given a host with a draft that says what kind of contest it is and who is taking part, but is judged on nothing
    When the host tries to publish the draft
    Then publishing is rejected because the contest is judged on nothing
    And the refusal is about no particular person or thing

  Scenario: A reader with no words of its own still gets the sentence
    Given a host with a draft where couples cook together, for 5 people of whom 4 are 2 couples and 1 has no partner
    When the assistant is asked to publish that draft on the host's behalf
    Then the assistant is told, in words, why it could not be published
