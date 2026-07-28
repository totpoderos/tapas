import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeToggle } from '../../src/index';

expect.extend(toHaveNoViolations);

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('offers to switch to dark when the current theme is light', () => {
    render(<ThemeToggle />); // jsdom reports no dark preference, so we start light
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
  });

  it('flips the theme on <html> and remembers the choice', async () => {
    render(<ThemeToggle />);

    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('tapas.theme')).toBe('dark');

    // The label now offers the way back.
    await userEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(localStorage.getItem('tapas.theme')).toBe('light');
  });

  it('starts from the previously chosen theme', () => {
    localStorage.setItem('tapas.theme', 'dark');
    render(<ThemeToggle />);

    // Already dark, so the button offers the way to light.
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<ThemeToggle />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
