Feature: An administrator manages who can reach this deployment
  Administration is its own kind of work, and the panel says so by offering
  nothing else: an administrator's navigation carries the people and no contests,
  no assistant, no activity. Not disabled — absent. What the panel draws still
  authorizes nothing; the API decides, and the screen only agrees with it.

  One list, keyed by address, so a person appears once however they arrived: an
  account speaks for them if they have one, and otherwise the newest invitation
  does. Standing is what a reader needs — administrator, host, invited, expired,
  revoked — and it is said in words.

  An invitation link is shown once and never stored, so the screen must not look
  as though it could be asked for again.

  Scenario: An administrator's panel offers administration and nothing else
    Given a signed-in administrator
    Then the panel offers the people of the deployment
    And it offers no contests, no assistant, and no activity

  Scenario: Everyone with access is listed once, with their standing
    Given a signed-in administrator in a deployment with hosts and outstanding invitations
    Then each person is listed once, by address
    And each says what standing they have
    And nobody appears twice

  Scenario: Standing is said in words
    Given a signed-in administrator looking at people of differing standing
    Then each standing is named
    And it is not told by colour alone

  Scenario: An administrator invites a host
    Given a signed-in administrator
    When they invite an address that has never been seen
    Then the person appears in the list as invited

  Scenario: An address already registered is refused with a reason
    Given a signed-in administrator and an address that already has an account
    When they invite that address
    Then they are told the address is already registered
    And no second entry is added for it

  Scenario: A link that could not be sent is shown once
    Given a signed-in administrator in a deployment that cannot send messages
    When they invite an address
    Then the link is shown to them to pass on
    And they are told it works once and is not shown again

  Scenario: A link shown once does not come back
    Given a signed-in administrator who was shown an invitation link
    When they reload the screen
    Then the link is not shown again
    And nothing on the screen offers to show it

  Scenario: An administrator resends an invitation from the person's row
    Given a signed-in administrator looking at an outstanding invitation
    When they resend it from that person's row
    Then the invitation is sent again

  Scenario: An administrator revokes an invitation from the person's row
    Given a signed-in administrator looking at an outstanding invitation
    When they revoke it from that person's row
    Then that person is listed as revoked
    And the invitation can no longer be accepted

  Scenario: The people are not a host's to see
    Given a signed-in host
    Then no part of the panel offers them a way to the people
    And going there anyway tells them plainly that the screen is not theirs
    And nobody's address is shown to them

  Scenario: The screen is keyboard-operable and free of accessibility violations
    Given a signed-in administrator looking at the people
    When they move through the screen using only the keyboard
    Then a person's row can be acted on without a mouse, showing where focus is
    And the screen has no accessibility violations

  Scenario: The screen reads in Spanish
    Given a signed-in administrator looking at the people
    When they switch the language to Spanish
    Then everything the screen says is in Spanish
    And the addresses are unchanged

  Scenario: The screen holds together on a narrow screen
    Given a signed-in administrator looking at the people on a narrow screen
    Then the screen does not spill sideways
    And it has no accessibility violations
