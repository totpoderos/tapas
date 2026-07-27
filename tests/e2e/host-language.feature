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

  Scenario: The language selector is accessible
    Given a visitor on any screen
    Then the language selector is a labelled control
    And the screen has no accessibility violations
