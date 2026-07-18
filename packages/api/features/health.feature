Feature: API health

  Scenario: The service reports it is healthy
    Given the API is running
    When a client requests the health endpoint
    Then the API responds that its status is ok
