Feature: Knowing what a draft still needs
  A host preparing a contest should learn what is left to say while they are
  still preparing it, not when publishing turns them away. Reading a draft says
  what it has not said yet — what kind of contest it is, who is taking part, how
  it is scored — and says nothing at all once there is nothing left. It is the
  same judgement publishing makes, answered before the host tries: a draft that
  reads as ready publishes, and a draft that publishes never read as short.

  Scenario: A draft that has not said what kind of contest it is says so
    Given a host preparing a draft named "Tapas Night" with Ana and Bob taking part and a "Taste" category, that has not said what kind of contest it is
    When the host asks for the details of "Tapas Night"
    Then the draft says it still needs what kind of contest it is

  Scenario: A draft short of more than one thing names each of them
    Given a host preparing a draft named "Half-baked" that has said nothing about what kind of contest it is nor how it is scored
    When the host asks for the details of "Half-baked"
    Then the draft says it still needs what kind of contest it is
    And the draft says it still needs how it is scored

  Scenario: A draft that is ready to publish says nothing is needed
    Given a host preparing a complete draft named "Tapas Night"
    When the host asks for the details of "Tapas Night"
    Then the draft says nothing is still needed

  Scenario: A live contest is never told what it still needs
    Given a host with a live contest named "Balcony Cook-off"
    When the host asks for the details of "Balcony Cook-off"
    Then the draft says nothing is still needed

  Scenario: A draft just created says what it still needs
    When a host creates a draft named "Tapas" and says nothing else about it
    Then the draft says it still needs what kind of contest it is
    And the draft says it still needs who is taking part
    And the draft says it still needs how it is scored

  Scenario: What a draft still needs is what publishing refuses it for
    Given a host preparing a draft named "Tapas Night" with Ana and Bob taking part and a "Taste" category, that has not said what kind of contest it is
    When the host tries to publish "Tapas Night"
    Then publishing is refused for exactly what the draft said it still needed
