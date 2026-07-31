## MODIFIED Requirements

### Requirement: Host and participant see the same results

The results a host reads SHALL name the same winners, in the same order, as the results the contest's participants read. A dish SHALL be identified the same way to both — by the name it was submitted under.

This SHALL hold however each audience's screen is drawn. The two may differ in styling, in layout, and in what else surrounds the outcome; they SHALL NOT differ in who won, in the order of the leaderboard, or in what a dish is called. The guarantee is a property of the results, not of the two screens happening to share a renderer.

#### Scenario: The two views agree

- **WHEN** a contest has been revealed and both its host and one of its participants read the results
- **THEN** the same dishes are named as winners, and the leaderboard is in the same order for both

#### Scenario: They still agree when they are drawn differently

- **WHEN** the host's results and a participant's results are rendered by different code
- **THEN** the winners named, their order, and the names they are given are the same for both
