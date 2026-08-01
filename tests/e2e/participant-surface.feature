Feature: The participant app has a surface of its own
  The host panel and the participant app are not used alike. A host administers
  from a desk; a cook stands in a room holding a plate, one-handed, in bad light,
  on a phone they did not set up for this. So the participant app is drawn its
  own way, in one appearance chosen for that room rather than deferred to a
  preference set for something else — and when there is nothing left to do, it
  says so plainly and offers the one way out instead of a screen of dead
  controls.

  Scenario: The two apps do not look alike
    Given the host panel and the participant app
    When each is opened
    Then the colour they lead with is not the same

  Scenario: A phone set to a dark appearance still gets the light one
    Given a phone whose appearance is set to dark
    When a participant opens the app
    Then they are shown the app's light appearance

  Scenario: Nothing offers to change the appearance
    Given a participant on any screen of the app
    Then nothing there offers to change how the app looks

  Scenario: The header is on every screen but the revealed results
    Given a participant moving between the steps open to them
    Then the same header names the product on each one

  Scenario: A contest that is gone says so, and offers the way out
    Given a participant whose contest has been deleted
    When they open it again
    Then they are told the contest is gone, and nothing suggests it was their doing
    And the only thing they can do is join another contest

  Scenario: A lost session says so, and offers the way back
    Given a participant whose session is no longer recognised
    When they open a screen that needs them to have joined
    Then they are told to join first, and that their dish and scores are still there
    And the only thing they can do is go to joining

  Scenario: The plain screens are readable on a small phone
    Given a participant on a screen that tells them there is nothing to do
    When it is shown in a 320px-wide viewport
    Then the page does not scroll sideways
    And the way out is still reachable and operable

  Scenario: The plain screens are accessible
    Given a participant on a screen that tells them there is nothing to do
    Then the screen has no accessibility violations
