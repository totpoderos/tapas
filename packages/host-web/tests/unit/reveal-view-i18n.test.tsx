import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import type { i18n as I18n } from 'i18next';
import { RevealView, type RevealData } from '@tapas/ui';
import { i18n as hostI18n } from '../../src/i18n';
import { i18n as participantI18n } from '../../../participant-web/src/i18n';

/**
 * The shared reveal view rendered against each app's REAL resource tree.
 *
 * Why this test exists: a component in `@tapas/ui` resolves its keys against
 * whichever app renders it, and i18next answers a missing key by echoing the key
 * itself — which, inside an `aria-label`, is what a screen reader announces. That
 * has already shipped here once (`LanguageSelect` reading out "language.label"),
 * and it survived both a unit test with a convenient flat fixture and an E2E
 * whose `getByLabel` matched a case-insensitive substring.
 *
 * So: real resources, both apps, accessible names asserted EXACTLY.
 *
 * Note where the teeth actually are. `RevealView` passes an English default to
 * every `t()`, so a missing resource falls back to real English words rather than
 * to the key — which is the point, but it also means the English assertions below
 * cannot fail for a missing key. **The Spanish case is the one that catches it**:
 * verified by emptying the host's `es/reveal.json`, which fails the host block and
 * leaves the participant block green.
 */

const REVEAL: RevealData = {
  contestName: 'Summer Tapas',
  overall: {
    winners: [{ dishId: 'D-bob', name: 'Tortilla' }],
    standings: [
      { dishId: 'D-bob', name: 'Tortilla', total: 5 },
      { dishId: 'D-ana', name: 'Patatas bravas', total: 3 },
    ],
  },
  categories: [
    { categoryId: 'taste', name: 'Taste', winners: [{ dishId: 'D-bob', name: 'Tortilla' }], standings: [] },
    { categoryId: 'look', name: 'Presentation', winners: [{ dishId: 'D-ana', name: 'Patatas bravas' }], standings: [] },
  ],
};

const APPS = [
  { app: 'host', i18n: hostI18n },
  { app: 'participant', i18n: participantI18n },
] as const;

/**
 * Bind the instance explicitly. Both apps call `initReactI18next`, which sets
 * react-i18next's *global* default — so with both imported here, whichever loaded
 * last would answer every `useTranslation()` and one app's resources would be
 * tested twice under two names.
 */
function renderFor(i18n: I18n, reveal: RevealData) {
  return render(
    <I18nextProvider i18n={i18n}>
      <RevealView reveal={reveal} />
    </I18nextProvider>,
  );
}

describe.each(APPS)('the shared reveal view, against the real $app resources', ({ i18n }) => {
  it('names its regions in words, not with resource keys', async () => {
    await i18n.changeLanguage('en');
    renderFor(i18n, REVEAL);

    expect(screen.getByRole('region', { name: 'Leaderboard' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Category winners' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Winner');
  });

  it('announces joint winners rather than picking one', async () => {
    await i18n.changeLanguage('en');
    renderFor(i18n, {
      ...REVEAL,
      overall: {
        winners: [
          { dishId: 'D-ana', name: 'Patatas bravas' },
          { dishId: 'D-bob', name: 'Tortilla' },
        ],
        standings: REVEAL.overall.standings,
      },
    });

    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Joint winners');
    expect(screen.getByText('Patatas bravas & Tortilla')).toBeInTheDocument();
  });

  it('translates into Spanish from the same keys', async () => {
    await i18n.changeLanguage('es');
    renderFor(i18n, REVEAL);

    expect(screen.getByRole('region', { name: 'Clasificación' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Ganadores por categoría' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Ganador');

    await i18n.changeLanguage('en');
  });
});
