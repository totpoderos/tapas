import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LanguageSelect, ThemeToggle } from '@tapas/ui';
import '../../src/i18n';

/**
 * The shared controls from `@tapas/ui` are rendered here against the host app's
 * REAL resource tree, not a hand-made fixture.
 *
 * Why this test exists: the selector originally asked for `language.label` while
 * the apps nest their files under `common`, so the key resolved to nothing and
 * i18next echoed it back — the control's accessible name was literally
 * "language.label". Its own unit test passed because that test built a flat
 * fixture, and the E2E passed because Playwright's `getByLabel` matches a
 * case-insensitive substring ("Language" is inside "language.label"). Asserting
 * the accessible name *exactly*, against the real resources, closes both holes.
 */
describe('shared @tapas/ui controls, against the real host resources', () => {
  it('names the language selector in words, not with a resource key', () => {
    render(<LanguageSelect />);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-label', 'Language');
  });

  it('names the theme toggle in words, not with a resource key', () => {
    render(<ThemeToggle />);
    const label = screen.getByRole('button').getAttribute('aria-label') ?? '';
    expect(label).toMatch(/^Switch to (dark|light) theme$/);
  });
});
