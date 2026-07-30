import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from '../../src/index';

describe('ProgressBar', () => {
  it('states the fact in words, with the bar itself hidden from assistive technology', () => {
    const { container } = render(
      <ProgressBar segments={[{ of: 0.5, tone: 'good' }]} label="13 of 18 votes sent" />,
    );

    // The words are the answer; a decorative bar announced as a percentage would
    // be worse than silence.
    expect(screen.getByText('13 of 18 votes sent')).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('clamps a fraction that would overrun the track', () => {
    const { container } = render(
      <ProgressBar segments={[{ of: 4, tone: 'good' }]} label="all of them" />,
    );

    const fill = container.querySelector('[aria-hidden="true"] > span') as HTMLElement;
    expect(fill.style.width).toBe('100%');
  });

  it('treats a negative fraction as nothing rather than as a reversed bar', () => {
    const { container } = render(
      <ProgressBar segments={[{ of: -1, tone: 'good' }]} label="none of them" />,
    );

    const fill = container.querySelector('[aria-hidden="true"] > span') as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });
});
