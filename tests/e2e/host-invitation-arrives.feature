Feature: An invitation arrives and is accepted
  An administrator invites someone; a message reaches that address carrying a
  link; that link works and makes a host who can sign in. This is the
  enrollment path running outside the API process for the first time — the link
  is read from the message that was actually sent, not from the database, which
  holds only a hash of it.

  The link is followed over the API rather than in a browser: the page it points
  at belongs to the next slice. What this feature pins is that a real message
  carries a real, working link.

  Scenario: An invited person receives their link and becomes a host
    Given an administrator has invited a new address
    When the link from that address's message is used to choose a password
    Then that person can sign in to the host app

  Scenario: The message reaches the invited address and nobody else
    Given an administrator has invited a new address
    Then exactly one message was sent, to that address
