Feature: Response hardening
  Every response the API sends carries baseline security protections,
  whichever capability answered it. Only the two frontends may call the API
  from a browser — anywhere else is refused. In production, the API is only
  reachable over HTTPS, and when something goes wrong unexpectedly it never
  reveals its internals.

  Scenario: A response carries standard security headers
    When any request is made to the API
    Then the response carries the standard hardening headers

  Scenario: A request from one of the frontends is allowed
    When a request arrives from the host app's origin
    Then the response allows that origin

  Scenario: A request from an unrecognized site is refused
    When a request arrives from an unrecognized origin
    Then the response does not allow that origin

  Scenario: A plain HTTP request is redirected to HTTPS in production
    Given the API is running in production
    When a request arrives over plain HTTP
    Then the response redirects to the HTTPS equivalent

  Scenario: An unexpected server error does not leak internals in production
    Given the API is running in production
    When an unexpected error occurs while handling a request
    Then the response is a generic error with no internal detail
