import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewDraft } from '../../src/pages/review-draft';
import { ApiError, type DraftContent, type StoredDraft } from '../../src/api/client';

expect.extend(toHaveNoViolations);

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return { ...actual, getDraft: vi.fn(), publishDraft: vi.fn(), updateDraft: vi.fn() };
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
    scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'fixed', min: 1, max: 5 }, uniquePerCategory: true },
    participants: [
      { id: 'p1', displayName: 'Ana' },
      { id: 'p2', displayName: 'Bruno' },
    ],
  },
};

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

/** The content passed to the latest updateDraft call. */
function savedContent(): DraftContent {
  const calls = vi.mocked(api.updateDraft).mock.calls;
  return calls[calls.length - 1]![1];
}

describe('Edit draft', () => {
  beforeEach(() => {
    vi.mocked(api.getDraft).mockReset().mockResolvedValue(DRAFT);
    vi.mocked(api.publishDraft).mockReset().mockResolvedValue('c1');
    vi.mocked(api.updateDraft).mockReset().mockResolvedValue();
  });
  afterEach(() => vi.clearAllMocks());

  it('loads the draft into editable fields', async () => {
    renderReview();

    expect(await screen.findByRole('heading', { name: /Edit .Summer Tapas./ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Each couple is scored together' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Couples cannot score each other' })).toBeChecked();
    expect(screen.getByLabelText('Category 1 name')).toHaveValue('Taste');
    expect(screen.getByLabelText('Participant 1 name')).toHaveValue('Ana');
    expect(screen.getByLabelText('Participant 2 name')).toHaveValue('Bruno');
  });

  it('saves changes to the rules', async () => {
    renderReview();
    await screen.findByRole('heading', { name: /Edit/ });

    await userEvent.click(screen.getByRole('radio', { name: 'Each person is scored on their own' }));
    await userEvent.click(screen.getByRole('radio', { name: 'No restriction' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(api.updateDraft).toHaveBeenCalledWith('d1', expect.anything());
    expect(savedContent().attribution).toBe('per_person');
    expect(savedContent().antiBias).toBe('none');
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });

  it('removes a participant', async () => {
    renderReview();
    await screen.findByRole('heading', { name: /Edit/ });

    await userEvent.click(screen.getByRole('button', { name: 'Remove Bruno' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(savedContent().participants?.map((p) => p.displayName)).toEqual(['Ana']);
  });

  it('pairs two participants as a couple', async () => {
    renderReview();
    await screen.findByRole('heading', { name: /Edit/ });

    await userEvent.selectOptions(screen.getByLabelText('Partner of Ana'), 'p2');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    const ps = savedContent().participants ?? [];
    expect(ps.find((p) => p.id === 'p1')?.partnerId).toBe('p2');
    expect(ps.find((p) => p.id === 'p2')?.partnerId).toBe('p1'); // reciprocal
  });

  it('requires a name to save', async () => {
    renderReview();
    await screen.findByRole('heading', { name: /Edit/ });

    await userEvent.clear(screen.getByLabelText('Contest name'));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(api.updateDraft).not.toHaveBeenCalled();
    expect(screen.getByText('A name is required.')).toBeInTheDocument();
  });

  it('publishes the draft and returns to the list', async () => {
    renderReview();
    await screen.findByRole('heading', { name: /Edit/ });

    await userEvent.click(screen.getByRole('button', { name: /Publish/ }));

    expect(api.publishDraft).toHaveBeenCalledWith('d1');
    expect(await screen.findByRole('heading', { name: 'Your contests' })).toBeInTheDocument();
  });

  it('announces the reason when a draft is too incomplete to publish', async () => {
    vi.mocked(api.publishDraft).mockRejectedValue(
      new ApiError(422, 'INCOMPLETE_DRAFT', 'The draft is missing its scoring rules.'),
    );
    renderReview();
    await screen.findByRole('heading', { name: /Edit/ });

    await userEvent.click(screen.getByRole('button', { name: /Publish/ }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/can.t go live yet/i);
    expect(alert).toHaveTextContent(/missing its scoring rules/i);
  });

  it('shows a not-found state for a draft that isn’t the host’s', async () => {
    vi.mocked(api.getDraft).mockRejectedValue(new ApiError(404, 'DRAFT_NOT_FOUND'));
    renderReview();

    expect(await screen.findByRole('heading', { name: 'Draft not found' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderReview();
    await screen.findByRole('heading', { name: /Edit/ });
    expect(await axe(container)).toHaveNoViolations();
  });
});
