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
