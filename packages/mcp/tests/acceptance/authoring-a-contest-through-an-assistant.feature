Feature: Authoring a contest through a connected assistant
  A host can build a contest through the assistant: create a draft, refine it,
  and publish it into a live contest. Creating and refining a draft are ordinary,
  reversible edits and happen directly. Publishing is destructive — a live
  contest cannot be un-published — so it goes through the same confirmation as
  any other destructive action.

  Scenario: The assistant creates a draft for the host
    Given a host with a personal access token
    When the assistant is asked to create a draft named "Summer Tapas"
    Then a draft named "Summer Tapas" is saved for the host

  Scenario: The assistant renames a draft
    Given a host with a saved draft
    When the assistant renames the draft to "Winter Tapas"
    Then the draft's name becomes "Winter Tapas"

  Scenario: Publishing a draft must be confirmed
    Given a host with a complete, publishable draft
    When the assistant is asked to publish the draft without a confirmation
    Then the draft is not published
    And the assistant is told the action needs confirming

  Scenario: A confirmed publish creates a live contest
    Given a host with a complete, publishable draft and the confirmation to publish it
    When the assistant publishes the draft with that confirmation
    Then the contest is live
