Feature: Claiming a deployment
  A deployment nobody has claimed offers itself to whoever holds the address it
  was configured with — and does so without taking sign-in away, because a
  deployment can hold host accounts while having no administrator, and those
  hosts need the screen they can actually use.

  This runs before everything else, and it is the only thing that can: the
  unclaimed state stops existing the moment the deployment is claimed.

  Scenario: An unclaimed deployment offers itself, without taking sign-in away
    Given a deployment with no administrator
    When anyone opens the sign-in screen
    Then they can still sign in
    And they are offered the way to set the deployment up

  Scenario: The deployment is claimed
    Given a deployment with no administrator
    When the configured address claims it and accepts the invitation
    Then the deployment has an administrator
