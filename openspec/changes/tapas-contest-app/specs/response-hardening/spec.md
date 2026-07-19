## ADDED Requirements

### Requirement: Every response carries standard security headers
Every API response SHALL carry baseline hardening headers, regardless of which capability answered it.

#### Scenario: A response carries standard security headers
- **WHEN** any request is made to the API
- **THEN** the response carries the standard hardening headers

### Requirement: Only the two frontends may call the API cross-origin
A request from one of the two known frontend origins SHALL be allowed. A request from any other origin SHALL NOT be allowed.

#### Scenario: A request from one of the frontends is allowed
- **WHEN** a request arrives from the host app's origin
- **THEN** the response allows that origin

#### Scenario: A request from an unrecognized site is refused
- **WHEN** a request arrives from an unrecognized origin
- **THEN** the response does not allow that origin

### Requirement: The API is only reachable over HTTPS in production
A plain HTTP request in production SHALL be redirected to its HTTPS equivalent.

#### Scenario: A plain HTTP request is redirected to HTTPS in production
- **WHEN** the API is running in production and a request arrives over plain HTTP
- **THEN** the response redirects to the HTTPS equivalent

### Requirement: Unexpected errors never leak internals in production
When an unexpected error occurs while handling a request in production, the response SHALL be a generic error with no internal detail (no stack trace, no exception message).

#### Scenario: An unexpected server error does not leak internals in production
- **WHEN** the API is running in production and an unexpected error occurs while handling a request
- **THEN** the response is a generic error with no internal detail
