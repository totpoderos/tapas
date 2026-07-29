Feature: An administrator sees the people
  An administrator sees everyone with access to their deployment, and everyone
  invited to it, as one list — one row per person, whether that person has an
  account or only an invitation. They invite from the screen, and revoke and
  resend from the rows.

  A host who reaches the screen is told it is not for them, and left there.

  Scenario: An administrator invites somebody and sees them appear
    Given an administrator looking at the people
    When they invite a new address
    Then that address appears as invited

  Scenario: An administrator resends and revokes from the row
    Given an administrator who has invited a new address
    When they resend that invitation
    And they revoke it
    Then that address appears as revoked

  Scenario: A host is told the screen is not for them
    Given a host who is not an administrator
    When they open the people screen
    Then they are told it is not for them
    And no other person's address appears
