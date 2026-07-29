Feature: Claiming a deployment
  A fresh deployment has no administrator and no way to make one, so it names
  its administrator in configuration before it ever starts. Only that address
  can claim it; anyone else is turned away and told nothing. Claiming sends an
  invitation, and accepting it makes the administrator. Once claimed, the door
  is shut for good — there is no self-service way to become the administrator
  of a deployment that already has one.

  Scenario: An unclaimed deployment says so
    Given a deployment configured for "operator@example.com" with no administrator
    When anyone asks whether it is unclaimed
    Then it reports that it is

  Scenario: The configured address claims the deployment
    Given a deployment configured for "operator@example.com" with no administrator
    When "operator@example.com" claims it
    Then an invitation is sent to "operator@example.com"

  Scenario: Another address cannot claim the deployment
    Given a deployment configured for "operator@example.com" with no administrator
    When "someone-else@example.com" tries to claim it
    Then claiming is refused
    And no message is sent to "someone-else@example.com"

  Scenario: A refused claim does not reveal the configured address
    Given a deployment configured for "operator@example.com" with no administrator
    When "someone-else@example.com" tries to claim it
    Then the refusal does not name "operator@example.com"

  Scenario: The person who claimed the deployment becomes its administrator
    Given a deployment configured for "operator@example.com" with no administrator
    When "operator@example.com" claims it and accepts with a strong password
    Then an administrator account exists for "operator@example.com"
    And that administrator can do administrative work

  Scenario: Claiming does not sign anybody in by itself
    Given a deployment configured for "operator@example.com" with no administrator
    When "operator@example.com" claims it and accepts with a strong password
    Then no session is granted by the acceptance itself

  Scenario: Claiming again sends a fresh link and kills the earlier one
    Given a deployment configured for "operator@example.com" with no administrator
    When "operator@example.com" claims it twice
    Then another message is sent to "operator@example.com"
    And it carries a different link
    And accepting with the earlier link is refused

  Scenario: A claimed deployment says so
    Given a deployment configured for "operator@example.com" with no administrator
    When "operator@example.com" claims it and accepts with a strong password
    And anyone asks whether it is unclaimed
    Then it reports that it is not

  Scenario: The configured address cannot claim a deployment twice
    Given a deployment configured for "operator@example.com" with no administrator
    When "operator@example.com" claims it and accepts with a strong password
    And "operator@example.com" tries to claim it again
    Then claiming is refused because the deployment is already claimed

  Scenario: A claim whose message cannot be sent still stands
    Given a deployment configured for "operator@example.com" whose mail server will take nothing
    When "operator@example.com" claims it
    Then claiming is not refused
    And the link is offered in that answer
    And accepting with that link makes the administrator
