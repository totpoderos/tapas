Feature: Choosing a light or dark theme
  Every screen carries a single control that flips the whole app between a light
  and a dark theme, so anyone can pick what's comfortable — bright rooms, dim
  rooms, or a personal preference. The choice is remembered, so it survives
  moving between screens and reloading. The control is a real, labelled button,
  reachable by keyboard and announced to assistive technology.

  Scenario: Switching to the dark theme and back
    Given a visitor on any screen with the light theme showing
    When they use the theme control to switch to dark
    Then the whole app is shown in the dark theme
    And the control now offers switching back to light

  Scenario: The chosen theme is remembered on reload
    Given a visitor who has switched to the dark theme
    When they reload the screen
    Then the app is still shown in the dark theme
