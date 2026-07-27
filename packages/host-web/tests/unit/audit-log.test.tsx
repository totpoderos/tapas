import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditLog } from '../../src/pages/audit-log';
import { ApiError, type AuditEntry } from '../../src/api/client';

expect.extend(toHaveNoViolations);

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return { ...actual, getAuditLog: vi.fn() };
});
import * as api from '../../src/api/client';

const entry = (over: Partial<AuditEntry> & Pick<AuditEntry, 'id' | 'type' | 'sourcePath'>): AuditEntry => ({
  actorId: 'host-1',
  occurredAt: '2026-07-21T10:00:00.000Z',
  ...over,
});

const LOG: AuditEntry[] = [
  entry({ id: '1', type: 'draft.saved', sourcePath: 'form' }),
  entry({ id: '2', type: 'contest.published', sourcePath: 'system', actorId: 'system' }),
  entry({ id: '3', type: 'contest.closed', sourcePath: 'form', confirmation: 'host' }),
];

function renderLog() {
  return render(
    <MemoryRouter initialEntries={['/log/c1']}>
      <Routes>
        <Route path="/log/:id" element={<AuditLog />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Activity log', () => {
  beforeEach(() => {
    vi.mocked(api.getAuditLog).mockReset();
    vi.mocked(api.getAuditLog).mockResolvedValue(LOG);
  });
  afterEach(() => vi.clearAllMocks());

  it('lists each recorded action with a readable label and its source', async () => {
    renderLog();
    const list = await screen.findByRole('list', { name: 'Activity' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(within(list).getByText('Draft saved')).toBeInTheDocument();
    expect(within(list).getByText('Contest published')).toBeInTheDocument();
    expect(within(list).getByText('Contest closed')).toBeInTheDocument();
  });

  it('marks a host-confirmed destructive action', async () => {
    renderLog();
    const closed = (await screen.findByText('Contest closed')).closest('li')!;
    expect(within(closed).getByText(/you confirmed/i)).toBeInTheDocument();
  });

  it('filters the log by source', async () => {
    renderLog();
    await screen.findByRole('list', { name: 'Activity' });

    await userEvent.selectOptions(screen.getByLabelText('Filter by source'), 'system');

    expect(screen.getByText('Contest published')).toBeInTheDocument();
    expect(screen.queryByText('Draft saved')).not.toBeInTheDocument();
    expect(screen.queryByText('Contest closed')).not.toBeInTheDocument();
  });

  it('shows a not-found message when the contest isn’t the host’s', async () => {
    vi.mocked(api.getAuditLog).mockRejectedValue(new ApiError(403, 'NOT_ALLOWED'));
    renderLog();
    expect(await screen.findByText(/isn.t yours to view/i)).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderLog();
    await screen.findByRole('list', { name: 'Activity' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
