import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatePill } from '../../src/index';

describe('StatePill', () => {
  it('reads as the word alone, with the shape hidden from assistive technology', () => {
    render(
      <StatePill tone="good" mark="●">
        Live
      </StatePill>,
    );

    // The mark is what makes the state legible without colour; the word is what
    // is announced, so the two must not be read out together as "● Live".
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('●')).toHaveAttribute('aria-hidden', 'true');
  });

  it('draws without a mark when there is no shape to give the state', () => {
    render(<StatePill tone="brand">Administrator</StatePill>);

    expect(screen.getByText('Administrator')).toBeInTheDocument();
    expect(screen.queryByText('●')).not.toBeInTheDocument();
  });
});
