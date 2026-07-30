import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewContest } from '../../src/pages/new-contest';
import { WithPanelSlots } from './support/panel-slots';
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
      <WithPanelSlots>
        <Routes>
          <Route path="/new" element={<NewContest />} />
          <Route path="/" element={<h1>Your contests</h1>} />
        </Routes>
      </WithPanelSlots>
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
    // Categories are chips now: added and removed, not edited in place.
    await userEvent.type(screen.getByLabelText('New category name'), 'Presentation');
    await userEvent.click(screen.getByRole('button', { name: 'Add category' }));

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
        categories: [
          { id: 'c1', name: 'Taste' },
          { id: 'c2', name: 'Presentation' },
        ],
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

  it('takes a category back off', async () => {
    renderForm();

    const categories = screen.getByRole('list', { name: 'Scoring categories' });
    expect(categories).toHaveTextContent('Taste');

    await userEvent.click(screen.getByRole('button', { name: 'Remove category Taste' }));

    expect(categories).not.toHaveTextContent('Taste');
  });

  it('asks for the ends of the band only once one is being fixed', async () => {
    renderForm();

    // Worked out automatically to begin with, so there are no ends to give.
    expect(screen.queryByLabelText('Lowest score')).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Fixed range'));

    expect(screen.getByLabelText('Lowest score')).toBeInTheDocument();
    expect(screen.getByLabelText('Highest score')).toBeInTheDocument();
  });

  it('puts saving and cancelling in the panel’s header, not in the form', async () => {
    const { container } = renderForm();

    /*
     * The header is outside the `<form>` in the DOM, so the save button reaches it
     * by name. If that attribute were dropped the button would simply do nothing,
     * which is exactly the sort of quiet break worth a test of its own.
     */
    const save = screen.getByRole('button', { name: 'Save as draft' });
    expect(save).toHaveAttribute('form', 'new-contest-form');
    expect(container.querySelector('form')?.contains(save)).toBe(false);

    // And it still submits, from out there.
    await userEvent.type(screen.getByLabelText('Contest name'), 'Headered');
    await userEvent.click(save);
    expect(api.createDraft).toHaveBeenCalledTimes(1);
  });

  it('keeps what was filled in when saving fails', async () => {
    vi.mocked(api.createDraft).mockRejectedValue(new Error('network'));
    renderForm();

    await userEvent.type(screen.getByLabelText('Contest name'), 'Doomed Feast');
    await userEvent.type(screen.getByLabelText('New participant name'), 'Ana');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save as draft' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t be saved/i);
    // Nothing thrown away: a failed save must not cost the host their typing.
    expect(screen.getByLabelText('Contest name')).toHaveValue('Doomed Feast');
    expect(screen.getByLabelText('Participant 1 name')).toHaveValue('Ana');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderForm();
    await userEvent.type(screen.getByLabelText('Contest name'), 'Summer Tapas');
    await userEvent.click(screen.getByLabelText('Fixed range'));
    expect(await axe(container)).toHaveNoViolations();
  });
});
