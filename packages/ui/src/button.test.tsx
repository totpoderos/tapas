import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './index';

describe('Button', () => {
  it('renders an accessible button that defaults to type=button', () => {
    render(<Button>Save draft</Button>);

    const button = screen.getByRole('button', { name: 'Save draft' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('type', 'button');
  });
});
