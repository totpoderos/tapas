Feature: Setting up a whole contest through a connected assistant
  A host can describe a whole contest in one go — what it is called, what kind it
  is, who is taking part, and what it is judged on — and have the assistant set
  it up. Nothing the host has never been shown is asked of the assistant in order
  to do that: what tells one participant or one scoring category from another is
  the system's to keep, not something a host states or an assistant invents. So
  the assistant gives names, and what it sets up is still made of things that can
  be told apart.

  Scenario: The assistant sets up a whole contest in one asking
    Given a host with a personal access token
    When the assistant is asked to set up a contest named "Tapas", judged on Taste and Originality, with Carlos, Alba and Juan taking part, scored from 1 to 5 with scores allowed to repeat
    Then a draft named "Tapas" is saved for the host
    And it is judged on Taste and Originality
    And Carlos, Alba and Juan are taking part
    And it is scored from 1 to 5

  # The assistant has no id to give and the host has never seen one, so naming
  # the categories has to be enough. Being told apart is what makes them two
  # things rather than one, and publishing is where that is checked.
  Scenario: What a contest is judged on is named, never identified
    Given a host with a personal access token
    When the assistant sets up a contest judged on Taste and Originality, naming them and nothing else
    Then the draft is judged on both of them
    And each can be told apart from the other

  Scenario: A contest set up that way can go live
    Given a host with a contest set up through the assistant by naming everything and identifying nothing
    When the assistant publishes that draft with a valid confirmation
    Then the contest is live
    And it is judged on two things

  # The same rule the roster already holds. Left in one feature so the two are
  # read together: whichever of them an assistant names, the system identifies.
  Scenario: Who is taking part is named, never identified
    Given a host with a personal access token
    When the assistant sets up a contest with Carlos, Alba and Juan taking part, naming them and nothing else
    Then all three are taking part
    And each can be told apart from the others
