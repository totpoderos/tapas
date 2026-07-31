import { render, screen, within, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { YourDish } from '../../src/pages/your-dish';
import type { Dish, Identity } from '../../src/api/client';

/** Renders the your-dish screen inside a router (it links to the score screen). */
const renderYourDish = (identity: Identity): RenderResult =>
  render(
    <MemoryRouter>
      <YourDish identity={identity} />
    </MemoryRouter>,
  );

expect.extend(toHaveNoViolations);

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return { ...actual, getDishes: vi.fn(), submitDish: vi.fn() };
});
import * as api from '../../src/api/client';

const ANA: Identity = { participantId: 'a', contestId: 'c1', displayName: 'Ana' };
const dish = (over: Partial<Dish> & Pick<Dish, 'dishId' | 'name' | 'submitterIds'>): Dish => ({
  description: null,
  ...over,
});

/**
 * What the dishes read answers: the dishes in, and how many the contest is
 * waiting for. Five places unless a test cares, which is the size the screen's
 * "n of five in" line is read against.
 */
const inContest = (dishes: Dish[], expected = 5) => ({ dishes, expected });

describe('Your dish', () => {
  beforeEach(() => {
    vi.mocked(api.getDishes).mockReset().mockResolvedValue(inContest([]));
    vi.mocked(api.submitDish).mockReset().mockResolvedValue(dish({ dishId: 'd-a', name: 'Patatas bravas', submitterIds: ['a'] }));
  });
  afterEach(() => vi.clearAllMocks());

  it('submits a dish with a name and shows it as theirs', async () => {
    vi.mocked(api.getDishes)
      .mockResolvedValueOnce(inContest([])) // initial load: nothing yet
      .mockResolvedValueOnce(
        inContest([dish({ dishId: 'd-a', name: 'Patatas bravas', submitterIds: ['a'] })]),
      ); // after submit
    renderYourDish(ANA);

    await userEvent.type(await screen.findByLabelText('Dish name'), 'Patatas bravas');
    await userEvent.click(screen.getByRole('button', { name: 'Submit dish' }));

    expect(api.submitDish).toHaveBeenCalledWith('c1', { name: 'Patatas bravas', description: undefined });
    const list = await screen.findByRole('list', { name: 'Dishes submitted' });
    const row = within(list).getByText('Patatas bravas').closest('li')!;
    expect(within(row).getByText('Yours')).toBeInTheDocument();
  });

  it('pre-fills the cook’s existing dish so re-submitting revises it', async () => {
    vi.mocked(api.getDishes).mockResolvedValue(
      inContest([dish({ dishId: 'd-a', name: 'Old name', submitterIds: ['a'] })]),
    );
    renderYourDish(ANA);

    // The form is pre-filled and the button offers to update, not add.
    expect(await screen.findByLabelText('Dish name')).toHaveValue('Old name');
    expect(screen.getByRole('button', { name: 'Update dish' })).toBeInTheDocument();
  });

  it('requires a name and submits nothing without one', async () => {
    renderYourDish(ANA);
    await screen.findByLabelText('Dish name');

    await userEvent.click(screen.getByRole('button', { name: 'Submit dish' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/name/i);
    expect(api.submitDish).not.toHaveBeenCalled();
  });

  it('shows the dishes submitted so far, including others’', async () => {
    vi.mocked(api.getDishes).mockResolvedValue(
      inContest([dish({ dishId: 'd-b', name: 'Tortilla', submitterIds: ['b'] })]),
    );
    renderYourDish(ANA);

    const list = await screen.findByRole('list', { name: 'Dishes submitted' });
    expect(within(list).getByText('Tortilla')).toBeInTheDocument();
    expect(within(list).queryByText('Yours')).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    vi.mocked(api.getDishes).mockResolvedValue(
      inContest([dish({ dishId: 'd-b', name: 'Tortilla', submitterIds: ['b'] })]),
    );
    const { container } = renderYourDish(ANA);
    await screen.findByLabelText('Dish name');
    expect(await axe(container)).toHaveNoViolations();
  });
});
