import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataTable } from '../../src/data-table';

function renderTable() {
  return render(
    <DataTable label="Activity">
      <thead>
        <tr>
          <th scope="col">Event</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Contest published</td>
        </tr>
      </tbody>
    </DataTable>,
  );
}

describe('DataTable', () => {
  it('is a real table, named', () => {
    renderTable();
    const table = screen.getByRole('table', { name: 'Activity' });
    expect(within(table).getByRole('columnheader', { name: 'Event' })).toBeInTheDocument();
  });

  it('lets the keyboard reach the frame that scrolls', () => {
    /*
     * The frame scrolls sideways when the columns will not fit. A region only a
     * pointer can scroll hides whatever is past its right edge from anyone
     * driving the app by keyboard (WCAG 2.1.1) — axe calls this
     * `scrollable-region-focusable`, and it caught it on the activity log's
     * fourth column.
     */
    const { container } = renderTable();
    const frame = container.firstElementChild!;
    expect(frame).toHaveAttribute('tabindex', '0');
    // Named, so landing on it says which table is about to scroll.
    expect(frame).toHaveAttribute('aria-label', 'Activity');
  });
});
