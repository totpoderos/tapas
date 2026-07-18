import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app';

afterEach(() => vi.unstubAllGlobals());

describe('Participant app', () => {
  it('renders the heading and shows the API health once loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ json: async () => ({ status: 'ok' }) })),
    );

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Tapas — Participant' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('ok')).toBeInTheDocument());
  });
});
