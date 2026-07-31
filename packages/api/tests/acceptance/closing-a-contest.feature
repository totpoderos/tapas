Feature: Closing a contest
  A contest stops accepting anything once it closes — no more dishes, no more
  scores, no more votes. How it closes depends on what the host chose: the
  host can trigger it directly, it can close on its own once everyone who
  joined has sent their vote, or it can close automatically once its
  scheduled time arrives. Once closed, it stays closed.

  Scenario: The host closes a contest directly
    Given a live contest whose host may close it at will
    When the host closes the contest
    Then the contest is closed

  Scenario: A contest closes on its own once everyone who joined has voted
    Given a live contest that closes once everyone has sent their vote, and everyone who joined has just sent theirs
    When anyone checks the contest afterwards
    Then the contest is closed

  Scenario: A contest does not close early while someone has not yet voted
    Given a live contest that closes once everyone has sent their vote, where one participant has not sent yet
    When anyone checks the contest
    Then the contest is still live

  Scenario: A contest does not close while a place is still unclaimed
    Given a live contest that closes once everyone has sent their vote, where everyone who joined has sent but a place is still open
    When anyone checks the contest
    Then the contest is still live
    And the participant who arrives afterwards can still score and send

  Scenario: A contest closes automatically once its scheduled time arrives
    Given a live contest scheduled to close at a set time, and that time has passed
    When anyone checks the contest
    Then the contest is closed

  Scenario: A closed contest refuses further dishes, scores, and votes
    Given a contest that has closed
    When a participant tries to submit a dish, save a score, or send a vote
    Then each attempt is refused because the contest is closed

  Scenario: A host cannot close another host's contest
    Given a live contest owned by one host
    When a different host tries to close it
    Then closing is refused as not allowed

  Scenario: Closing an already-closed contest changes nothing
    Given a contest that has closed
    When the host tries to close it again
    Then closing is refused because the contest is already closed
