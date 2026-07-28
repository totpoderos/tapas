Feature: The contest is usable when text is enlarged

  A participant uses the app standing up at a venue, often on a small phone and
  often with the system font size turned up. Enlarging the content must not take
  anything away: no sideways scrolling to read, and every control still reachable
  and operable.

  Scenario: Scoring works at double text size on a small screen
    Given a live contest I have joined
    When I open the score screen with the content enlarged to twice its size
    Then the page does not scroll sideways
    And I can still score every dish and send my vote

  Scenario: The results are readable at double text size on a small screen
    Given a contest whose results have been revealed
    When I open the results with the content enlarged to twice its size
    Then the page does not scroll sideways
    And the winner is still announced
