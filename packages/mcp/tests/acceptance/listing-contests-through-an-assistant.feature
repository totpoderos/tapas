Feature: Listing contests through a connected assistant
  A host can ask a connected assistant "what contests do I have?" and get back all
  of their contests in one place — the ones still being prepared and the ones
  already published alike. The assistant acts strictly as that host: it lists only
  contests the host owns, and only while the token is valid. This gives the host
  an overview by name, so they never have to remember an internal identifier.

  Scenario: The assistant lists the host's contests
    Given a host with a personal access token and two contests they own
    When the assistant is asked to list the host's contests with the host's token
    Then both of the host's contests are listed

  Scenario: The assistant is told how each contest is going
    Given a host with a personal access token and a published contest they own
    When the assistant is asked to list the host's contests with the host's token
    Then that contest is listed with its join code and its progress
    And it is listed with what it is judged on

  Scenario: The assistant lists only the host's own contests
    Given a host with a personal access token, and a contest owned by a different host
    When the assistant is asked to list the host's contests with the host's token
    Then the other host's contest is not listed

  Scenario: Without a valid token the assistant cannot list contests
    When the assistant is asked to list contests without a valid personal access token
    Then the request is refused as not authorized
