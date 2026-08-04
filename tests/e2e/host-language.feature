Feature: Reading the host app in English or Spanish
  Every screen of the host app can be read in English or Spanish, chosen from a
  language selector present on every screen. The choice is remembered across
  navigation and reloads. On a first visit the app follows the browser's
  preferred language, falling back to English. The document's language attribute
  is kept in step so assistive technology pronounces the page correctly.

  Scenario: A first visit follows a supported browser language
    Given a visitor whose browser prefers Spanish
    When they open the host app for the first time
    Then the app is shown in Spanish
    And the document language is "es"

  Scenario: An unsupported browser language falls back to English
    Given a visitor whose browser prefers a language the app does not offer
    When they open the host app
    Then the app is shown in English

  Scenario: Choosing a language switches the whole screen at once
    Given a visitor reading the host app in English
    When they choose "Español" from the language selector
    Then the whole screen is shown in Spanish
    And the document language becomes "es"

  Scenario: The chosen language is remembered across navigation and reload
    Given a visitor who has chosen Spanish
    When they move to another screen and reload
    Then the app is still shown in Spanish

  # A refusal is written by the system for a host to read, so it is interface
  # text and belongs in their language — even though it reaches the screen from
  # the API. What it names is theirs and stays as they wrote it.
  Scenario: A refusal to publish is read in the chosen language
    Given a host reading the app in Spanish, with a contest that has not said what kind it is
    When they try to put that contest live
    Then they are told why it cannot go live, in Spanish

  Scenario: A refusal names the things it is about as the host wrote them
    Given a host reading the app in Spanish, with a contest judged on two things that cannot be told apart
    When they try to put that contest live
    Then they are told why it cannot go live, in Spanish
    And it names both of those things exactly as they named them

  Scenario: The assistant gives the same reason in the same language
    Given a host reading the app in Spanish, with a contest that has not said what kind it is
    When they ask the assistant to put that contest live
    Then they are told why it cannot go live, in Spanish

  Scenario: The language selector is accessible
    Given a visitor on any screen
    Then the language selector is a labelled control
    And the screen has no accessibility violations
