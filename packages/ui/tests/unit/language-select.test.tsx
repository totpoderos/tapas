import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LanguageSelect, createI18n } from '../../src/index';

expect.extend(toHaveNoViolations);

// A tiny two-language instance, enough to drive the selector.
function renderSelect() {
  const i18n = createI18n({
    en: { translation: { language: { label: 'Language' } } },
    es: { translation: { language: { label: 'Idioma' } } },
  });
  return render(
    <I18nextProvider i18n={i18n}>
      <LanguageSelect />
    </I18nextProvider>,
  );
}

describe('LanguageSelect', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('lang');
  });
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('lang');
  });

  it('offers every registered language, each named in its own language', () => {
    renderSelect();
    const select = screen.getByLabelText('Language');
    expect(select).toHaveValue('en'); // jsdom reports no Spanish preference
    expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Español' })).toBeInTheDocument();
  });

  it('switches the language, sets the document language, and remembers the choice', async () => {
    renderSelect();

    await userEvent.selectOptions(screen.getByLabelText('Language'), 'es');

    expect(document.documentElement).toHaveAttribute('lang', 'es');
    expect(localStorage.getItem('tapas.lang')).toBe('es');
    // The selector's own label is translated too, so it now reads in Spanish.
    expect(screen.getByLabelText('Idioma')).toHaveValue('es');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderSelect();
    expect(await axe(container)).toHaveNoViolations();
  });
});
