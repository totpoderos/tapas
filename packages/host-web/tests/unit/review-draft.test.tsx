import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewDraft } from '../../src/pages/review-draft';
import { ApiError, type StoredDraft } from '../../src/api/client';

expect.extend(toHaveNoViolations);

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return { ...actual, getDraft: vi.fn(), publishDraft: vi.fn(), renameDraft: vi.fn() };
});
import * as api from '../../src/api/client';

const DRAFT: StoredDraft = {
  id: 'd1',
  status: 'draft',
  createdAt: '2026-07-20T10:00:00.000Z',
  updatedAt: '2026-07-20T10:00:00.000Z',
  content: {
    name: 'Summer Tapas',
    attribution: 'per_couple',
    antiBias: 'couples',
    scoring: {
      categories: [{ id: 'c1', name: 'Taste' }],
      range: { type: 'fixed', min: 1, max: 5 },
      uniquePerCategory: true,
    },
    participants: [
      { id: 'p1', displayName: 'Ana' },
      { id: 'p2', displayName: 'Bruno' },
    ],
  },
};

/** Renders the review screen at /drafts/d1 with a stub list page for navigation. */
function renderReview() {
  return render(
    <MemoryRouter initialEntries={['/review/d1']}>
      <Routes>
        <Route path="/review/:id" element={<ReviewDraft />} />
        <Route path="/" element={<h1>Your contests</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Review draft', () => {
  beforeEach(() => {
    vi.mocked(api.getDraft).mockReset();
    vi.mocked(api.publishDraft).mockReset();
    vi.mocked(api.renameDraft).mockReset();
    vi.mocked(api.getDraft).mockResolvedValue(DRAFT);
    vi.mocked(api.publishDraft).mockResolvedValue('c1');
    vi.mocked(api.renameDraft).mockResolvedValue();
  });
  afterEach(() => vi.clearAllMocks());

  it('shows the rules the host configured', async () => {
    renderReview();

    expect(await screen.findByRole('heading', { name: /Review .Summer Tapas./ })).toBeInTheDocument();
    expect(screen.getByText('Each couple is scored together')).toBeInTheDocument();
    expect(screen.getByText('Couples cannot score each other')).toBeInTheDocument();
    expect(screen.getByText('Taste')).toBeInTheDocument();
    expect(screen.getByText('1–5')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Bruno')).toBeInTheDocument();
  });

  it('publishes the draft and returns to the list', async () => {
    renderReview();
    await screen.findByRole('heading', { name: /Review/ });

    await userEvent.click(screen.getByRole('button', { name: /Publish/ }));

    expect(api.publishDraft).toHaveBeenCalledWith('d1');
    expect(await screen.findByRole('heading', { name: 'Your contests' })).toBeInTheDocument();
  });

  it('announces the reason when a draft is too incomplete to publish', async () => {
    vi.mocked(api.publishDraft).mockRejectedValue(
      new ApiError(422, 'INCOMPLETE_DRAFT', 'The draft is missing its scoring rules.'),
    );
    renderReview();
    await screen.findByRole('heading', { name: /Review/ });

    await userEvent.click(screen.getByRole('button', { name: /Publish/ }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/can.t go live yet/i);
    expect(alert).toHaveTextContent(/missing its scoring rules/i);
    // Still on the review screen, not navigated away.
    expect(screen.getByRole('heading', { name: /Review/ })).toBeInTheDocument();
  });

  it('renames the draft', async () => {
    renderReview();
    await screen.findByRole('heading', { name: /Review/ });

    const nameField = screen.getByLabelText('Contest name');
    await userEvent.clear(nameField);
    await userEvent.type(nameField, 'Summer Tapas Final');
    await userEvent.click(screen.getByRole('button', { name: 'Rename' }));

    expect(api.renameDraft).toHaveBeenCalledWith('d1', 'Summer Tapas Final');
  });

  it('shows a not-found state for a draft that isn’t the host’s', async () => {
    vi.mocked(api.getDraft).mockRejectedValue(new ApiError(404, 'DRAFT_NOT_FOUND'));
    renderReview();

    expect(await screen.findByRole('heading', { name: 'Draft not found' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderReview();
    await screen.findByRole('heading', { name: /Review/ });
    expect(await axe(container)).toHaveNoViolations();
  });
});
