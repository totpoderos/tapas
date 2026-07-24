import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewContest } from '../../src/pages/new-contest';
import type { DraftContent } from '../../src/api/client';

expect.extend(toHaveNoViolations);

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return { ...actual, createDraft: vi.fn() };
});
import * as api from '../../src/api/client';

/** Renders the form at /new with a stub list page, so a save can navigate to "/". */
function renderForm() {
  return render(
    <MemoryRouter initialEntries={['/new']}>
      <Routes>
        <Route path="/new" element={<NewContest />} />
        <Route path="/" element={<h1>Your contests</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('New contest form', () => {
  // Reset at the START of each test: the async save + navigate in one test can
  // otherwise leave a stray recorded call that an afterEach clear would miss.
  beforeEach(() => {
    vi.mocked(api.createDraft).mockReset();
    vi.mocked(api.createDraft).mockResolvedValue('draft-1');
  });
  afterEach(() => vi.clearAllMocks());

  it('saves the rule-space choices as a draft and returns to the list', async () => {
    renderForm();

    await userEvent.type(screen.getByLabelText('Contest name'), 'Summer Tapas');
    await userEvent.click(screen.getByLabelText('Each couple is scored together'));
    await userEvent.click(screen.getByLabelText('Couples cannot score each other'));
    await userEvent.type(screen.getByLabelText('Category 1 name'), ' & Presentation');

    await userEvent.type(screen.getByLabelText('New participant name'), 'Ana');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.type(screen.getByLabelText('New participant name'), 'Bruno');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await userEvent.click(screen.getByRole('button', { name: 'Save as draft' }));

    expect(api.createDraft).toHaveBeenCalledTimes(1);
    const content = vi.mocked(api.createDraft).mock.calls[0]![0] as DraftContent;
    expect(content).toMatchObject({
      name: 'Summer Tapas',
      attribution: 'per_couple',
      antiBias: 'couples',
      scoring: {
        categories: [{ id: 'c1', name: 'Taste & Presentation' }],
        range: { type: 'auto' },
        uniquePerCategory: true,
      },
      participants: [
        { id: 'p1', displayName: 'Ana' },
        { id: 'p2', displayName: 'Bruno' },
      ],
    });
    expect(await screen.findByRole('heading', { name: 'Your contests' })).toBeInTheDocument();
  });

  it('captures a fixed score range when chosen', async () => {
    renderForm();

    await userEvent.type(screen.getByLabelText('Contest name'), 'Fixed Range Feast');
    await userEvent.click(screen.getByLabelText('Fixed range'));
    await userEvent.clear(screen.getByLabelText('Lowest score'));
    await userEvent.type(screen.getByLabelText('Lowest score'), '0');
    await userEvent.clear(screen.getByLabelText('Highest score'));
    await userEvent.type(screen.getByLabelText('Highest score'), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Save as draft' }));

    const content = vi.mocked(api.createDraft).mock.calls[0]![0] as DraftContent;
    expect(content.scoring?.range).toEqual({ type: 'fixed', min: 0, max: 5 });
  });

  it('refuses to save without a name and announces it', async () => {
    renderForm();

    await userEvent.click(screen.getByRole('button', { name: 'Save as draft' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/name is required/i);
    expect(api.createDraft).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'New contest' })).toBeInTheDocument();
  });

  it('lets a host remove a participant they added', async () => {
    renderForm();

    await userEvent.type(screen.getByLabelText('New participant name'), 'Ana');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByLabelText('Participant 1 name')).toHaveValue('Ana');

    await userEvent.click(screen.getByRole('button', { name: 'Remove participant Ana' }));
    expect(screen.queryByLabelText('Participant 1 name')).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderForm();
    await userEvent.type(screen.getByLabelText('Contest name'), 'Summer Tapas');
    await userEvent.click(screen.getByLabelText('Fixed range'));
    expect(await axe(container)).toHaveNoViolations();
  });
});
