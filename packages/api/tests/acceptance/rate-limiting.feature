Feature: Rate limiting
  Sensitive entry points — signing in, and joining a contest by its code — are
  throttled against rapid repeated attempts, on top of (not instead of) any
  account lockout. This defends against brute-forcing a password or a join
  code from a single source.

  Scenario: Repeated rapid login attempts are throttled
    When many login attempts arrive in rapid succession from the same source
    Then further attempts are refused as too many requests

  Scenario: Repeated rapid join attempts are throttled
    When many attempts to join a contest arrive in rapid succession from the same source
    Then further attempts are refused as too many requests

  Scenario: Ordinary traffic is not throttled
    When a handful of requests are made well within the limit
    Then each is handled normally

  # A deployment may answer from more than one instance. The count has to belong
  # to the deployment rather than to whichever one happened to answer — five per
  # instance is not the limit this says it is, and nothing about a request or a
  # log would tell the difference.
  Scenario: Attempts spread across instances are counted together
    Given a deployment answering from two instances
    When attempts from one source are spread across both, more than the limit in total
    Then the source is refused as though they had all arrived at one

  Scenario: A newly started instance does not reset the count
    Given a deployment answering from two instances
    When a source spends its attempts on one instance, and a fresh instance starts
    Then that source is still refused by the fresh one

  # A control whose failure lets the thing through is not a control. These are
  # the two entry points an attacker reaches for first.
  Scenario: A count that cannot be read refuses the attempt
    Given a deployment whose record of attempts cannot be read
    When a login attempt arrives
    Then it is refused

  Scenario: A source that waited is served again
    When a source spends its attempts and then waits out the window
    Then it is served again
