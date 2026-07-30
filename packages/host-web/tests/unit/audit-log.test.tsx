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
  return { ...actual, getAuditLog: vi.fn(), getAuditLogFile: vi.fn() };
});
import * as api from '../../src/api/client';
import { WithPanelSlots } from './support/panel-slots';

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
      <WithPanelSlots>
        <Routes>
          <Route path="/log/:id" element={<AuditLog />} />
        </Routes>
      </WithPanelSlots>
    </MemoryRouter>,
  );
}

/** The row an event's name sits in, so an assertion is about that entry alone. */
const rowOf = (event: HTMLElement) => event.closest('tr')!;

describe('Activity log', () => {
  beforeEach(() => {
    vi.mocked(api.getAuditLog).mockReset();
    vi.mocked(api.getAuditLog).mockResolvedValue(LOG);
  });
  afterEach(() => vi.clearAllMocks());

  it('gives each recorded action a row saying what, how, who and when', async () => {
    renderLog();
    const table = await screen.findByRole('table', { name: 'Activity' });
    // Three entries plus the heading row.
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    for (const column of ['Event', 'Source', 'Actor', 'When']) {
      expect(within(table).getByRole('columnheader', { name: column })).toBeInTheDocument();
    }

    const published = rowOf(within(table).getByText('Contest published'));
    expect(within(published).getByText('System')).toBeInTheDocument();
    expect(within(published).getByText('the system')).toBeInTheDocument();
  });

  it('says how an action was triggered in words, not by colour alone', async () => {
    renderLog();
    const table = await screen.findByRole('table', { name: 'Activity' });

    expect(within(rowOf(within(table).getByText('Draft saved'))).getByText('In-app')).toBeInTheDocument();
    expect(within(rowOf(within(table).getByText('Contest published'))).getByText('System')).toBeInTheDocument();
  });

  it('marks a host-confirmed destructive action, and only that one', async () => {
    renderLog();
    const closed = rowOf(await screen.findByText('Contest closed'));
    expect(within(closed).getByText(/you confirmed/i)).toBeInTheDocument();

    const saved = rowOf(screen.getByText('Draft saved'));
    expect(within(saved).queryByText(/you confirmed/i)).not.toBeInTheDocument();
  });

  it('narrows the log to one source, and widens it again', async () => {
    renderLog();
    await screen.findByRole('table', { name: 'Activity' });

    await userEvent.click(screen.getByRole('radio', { name: /System/ }));

    expect(screen.getByText('Contest published')).toBeInTheDocument();
    expect(screen.queryByText('Draft saved')).not.toBeInTheDocument();
    expect(screen.queryByText('Contest closed')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'All sources' }));

    expect(screen.getByText('Draft saved')).toBeInTheDocument();
    expect(screen.getByText('Contest closed')).toBeInTheDocument();
  });

  it('offers the source filter as one choice of four, named as a group', async () => {
    renderLog();
    await screen.findByRole('table', { name: 'Activity' });

    const filter = screen.getByRole('group', { name: 'Filter by source' });
    expect(within(filter).getAllByRole('radio')).toHaveLength(4);
    expect(within(filter).getByRole('radio', { name: 'All sources' })).toBeChecked();
  });

  it('distinguishes nothing from this source from nothing having happened', async () => {
    renderLog();
    await screen.findByRole('table', { name: 'Activity' });

    // Nothing came through a connected tool, but the contest does have a history:
    // saying "nothing has happened" here would be untrue.
    await userEvent.click(screen.getByRole('radio', { name: /Connected tool/ }));

    expect(screen.getByText(/nothing from this source yet/i)).toBeInTheDocument();
    expect(screen.getByText(/does have a history/i)).toBeInTheDocument();
    expect(screen.queryByText(/nothing has happened to this contest/i)).not.toBeInTheDocument();
  });

  it('says plainly when nothing has happened at all', async () => {
    vi.mocked(api.getAuditLog).mockResolvedValue([]);
    renderLog();

    expect(await screen.findByText(/nothing has happened to this contest yet/i)).toBeInTheDocument();
    // And the filter is still there, so the state is one a host can act on.
    expect(screen.getByRole('group', { name: 'Filter by source' })).toBeInTheDocument();
  });

  it('names the tool an assistant acted through', async () => {
    vi.mocked(api.getAuditLog).mockResolvedValue([
      entry({ id: '9', type: 'draft.updated', sourcePath: 'mcp', toolName: 'rename_draft' }),
    ]);
    renderLog();

    const row = rowOf(await screen.findByText('Draft renamed'));
    expect(within(row).getByText('Connected tool')).toBeInTheDocument();
    expect(within(row).getByText('rename_draft')).toBeInTheDocument();
  });

  it('shows a not-found message when the contest isn’t the host’s', async () => {
    vi.mocked(api.getAuditLog).mockRejectedValue(new ApiError(403, 'NOT_ALLOWED'));
    renderLog();
    expect(await screen.findByText(/isn.t yours to view/i)).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderLog();
    await screen.findByRole('table', { name: 'Activity' });
    expect(await axe(container)).toHaveNoViolations();
  });

  describe('taking the log away as a file', () => {
    const FILE = { blob: new Blob(['event\r\n']), filename: 'Summer-Tapas-activity-log.csv' };

    beforeEach(() => {
      vi.mocked(api.getAuditLogFile).mockReset();
      vi.mocked(api.getAuditLogFile).mockResolvedValue(FILE);
      // jsdom has neither, and a download is what this button is for.
      URL.createObjectURL = vi.fn(() => 'blob:log');
      URL.revokeObjectURL = vi.fn();
    });

    it('saves the file under the name the server gave it', async () => {
      renderLog();
      await screen.findByRole('table', { name: 'Activity' });

      const clicks: HTMLAnchorElement[] = [];
      const realClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
        clicks.push(this);
      };
      try {
        await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
      } finally {
        HTMLAnchorElement.prototype.click = realClick;
      }

      expect(api.getAuditLogFile).toHaveBeenCalledWith('c1');
      // The server names the file; the panel does not invent one.
      expect(clicks[0]?.download).toBe('Summer-Tapas-activity-log.csv');
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:log');
    });

    it('says so in the panel when the file is refused, keeping the log on screen', async () => {
      vi.mocked(api.getAuditLogFile).mockRejectedValue(new ApiError(403, 'NOT_ALLOWED'));
      renderLog();
      await screen.findByRole('table', { name: 'Activity' });

      await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t be prepared/i);
      // The refusal is told beside the log, not instead of it.
      expect(screen.getByRole('table', { name: 'Activity' })).toBeInTheDocument();
    });

    it('is not offered when there is no history to take', async () => {
      vi.mocked(api.getAuditLog).mockResolvedValue([]);
      renderLog();

      await screen.findByText(/nothing has happened to this contest yet/i);
      expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument();
    });

    it('puts the action in the panel’s header, not in the surface', async () => {
      const { container } = renderLog();
      await screen.findByRole('table', { name: 'Activity' });

      const button = screen.getByRole('button', { name: 'Export CSV' });
      expect(container.querySelector('main')?.contains(button)).toBe(false);
    });
  });
});
