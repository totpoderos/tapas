Feature: Sending a vote
  Once a judge is done scoring, they send their vote — a final step with no
  undo. Sending is only allowed once every dish open to them has been scored
  in every category. If the contest requires a strict ranking, the scores in
  each category must use every value exactly once. Once sent, nothing about
  that vote can change.

  Scenario: A judge sends a complete vote
    Given a live contest where Ana has scored every dish open to her, in every category
    When Ana sends her vote
    Then her vote is locked as sent

  Scenario: An incomplete vote cannot be sent
    Given a live contest where Ana has left a dish unscored
    When Ana tries to send her vote
    Then sending is refused because her vote is incomplete

  Scenario: A ranking vote must use each value exactly once
    Given a live contest that requires a strict ranking, where Ana has given two dishes the same score in "Taste"
    When Ana tries to send her vote
    Then sending is refused because each score in that category must be used exactly once

  Scenario: A sent vote cannot be changed
    Given a live contest where Ana has sent her vote
    When Ana tries to save another score
    Then saving is refused because her vote has already been sent

  Scenario: A vote cannot be sent twice
    Given a live contest where Ana has sent her vote
    When Ana tries to send her vote again
    Then sending is refused because her vote has already been sent

  Scenario: Sending a vote requires having claimed a place
    Given a live contest
    When a vote is sent with no participant token
    Then sending is refused as not signed in
