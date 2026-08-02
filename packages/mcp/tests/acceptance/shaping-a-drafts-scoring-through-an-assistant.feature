Feature: Shaping a draft's scoring through a connected assistant
  A host settles how a contest is judged by asking for it — what it is judged on,
  the range scores are given within, and whether a score may be used twice in the
  same category. Each is its own asking, naming the draft it changes, so a host
  can change one thing without restating the rest and nothing they did not
  mention is disturbed.

  This is for drafts only. Once a contest is published its scoring is settled,
  and asking to change it is refused.

  Adding is an ordinary change and happens straight away. Removing something the
  host already named takes work away, so it waits to be confirmed, exactly as
  removing a person does.

  Scenario: The assistant adds something for a draft to be judged on
    Given a host with a personal access token and a draft named "Tapas Night" judged on "Taste"
    When the assistant is asked to judge "Tapas Night" on "Presentation" too
    Then "Tapas Night" is judged on "Taste" and "Presentation"

  # A category is addressed by its name, the way a contest is. Two categories
  # sharing a name would leave the host unable to say which one they meant to
  # remove — so the name has to stay usable as an address.
  Scenario: A category the draft is already judged on is refused
    Given a host with a personal access token and a draft named "Tapas Night" judged on "Taste"
    When the assistant is asked to judge "Tapas Night" on "Taste" again
    Then the request is refused because the draft is already judged on that
    And "Tapas Night" is judged on "Taste" alone

  Scenario: Removing something a draft is judged on waits to be confirmed
    Given a host with a personal access token and a draft named "Tapas Night" judged on "Taste" and "Presentation"
    When the assistant is asked to stop judging "Tapas Night" on "Presentation", without confirming
    Then "Tapas Night" is still judged on "Taste" and "Presentation"
    And the assistant is told the action needs confirming

  Scenario: The assistant stops judging on something once the host confirms
    Given a host with a personal access token and a draft named "Tapas Night" judged on "Taste" and "Presentation"
    When the assistant is asked to stop judging "Tapas Night" on "Presentation", confirming
    Then "Tapas Night" is judged on "Taste" alone

  Scenario: Removing something the draft is not judged on changes nothing
    Given a host with a personal access token and a draft named "Tapas Night" judged on "Taste"
    When the assistant is asked to stop judging "Tapas Night" on "Presentation", confirming
    Then "Tapas Night" is judged on "Taste" alone
    And the answer says it was not judged on that

  Scenario: The assistant sets the range scores are given within
    Given a host with a personal access token and a draft named "Tapas Night"
    When the assistant is asked to score "Tapas Night" between 1 and 10
    Then "Tapas Night" is scored between 1 and 10

  Scenario: The assistant lets the range be worked out from the contest
    Given a host with a personal access token and a draft named "Tapas Night" scored between 1 and 10
    When the assistant is asked to let "Tapas Night" work its own range out
    Then "Tapas Night" works its range out from the contest

  Scenario: The assistant settles that each score may be used only once
    Given a host with a personal access token and a draft named "Tapas Night"
    When the assistant is asked that each score in "Tapas Night" be used only once per category
    Then "Tapas Night" requires a different score for each dish in a category

  Scenario: The assistant settles that a score may be repeated
    Given a host with a personal access token and a draft named "Tapas Night" where each score is used only once
    When the assistant is asked to let scores repeat in "Tapas Night"
    Then "Tapas Night" allows the same score for more than one dish in a category

  # The rule this whole way of working rests on: one asking changes one thing.
  Scenario: Changing one part of the scoring leaves the rest alone
    Given a host with a personal access token and a draft named "Tapas Night" judged on "Taste", scored between 1 and 10, with Ana and Bob taking part
    When the assistant is asked to let "Tapas Night" work its own range out
    Then "Tapas Night" is still judged on "Taste"
    And Ana and Bob are still taking part in "Tapas Night"

  Scenario: A published contest's scoring cannot be changed
    Given a host with a personal access token and a published contest named "Tapas Night"
    When the assistant is asked to judge "Tapas Night" on "Presentation"
    Then no draft is found
    And the published contest is unchanged

  # Deliberately kept, not fixed here. A range whose bounds make no range is two
  # perfectly good numbers in the right shape; what is wrong with it is only
  # visible against the whole contest, which is what publishing checks. The panel
  # accepts it and publishing refuses it, and asking behaves the same way — the
  # alternative is a second validator that the form does not share.
  Scenario: A range that makes no sense is kept until publishing refuses it
    Given a host with a personal access token and a draft named "Tapas Night"
    When the assistant is asked to score "Tapas Night" between 5 and 2
    Then "Tapas Night" is scored between 5 and 2
    And publishing "Tapas Night" is refused because the range is not one scores can be given in
