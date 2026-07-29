Feature: An invitation arrives and is accepted
  The enrollment path end to end, as the people in it experience it. A fresh
  deployment sends anyone anonymous to the screen for claiming it. Once claimed,
  an administrator invites someone; a message reaches that address carrying a
  link; opening that link in a browser and choosing a password makes a host who
  lands on their own contests.

  The link is read from the message that was actually sent, never from the
  database, which holds only a hash of it.

  Scenario: A deployment nobody has claimed offers itself
    Given a deployment with no administrator
    When anyone opens it
    Then they are shown the screen for claiming it

  Scenario: An invited person opens their link and becomes a host
    Given an administrator has invited a new address
    When the invited person opens the link from their message and chooses a password
    Then they land on their own contests

  Scenario: A link that has already been used says so
    Given an invitation whose link has already been used
    When someone opens that link
    Then they are told it cannot be used
    And they are not asked for a password

  Scenario: The message reaches the invited address and nobody else
    Given an administrator has invited a new address
    Then exactly one message was sent, to that address
