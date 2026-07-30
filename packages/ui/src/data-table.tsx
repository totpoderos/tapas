import type { ReactNode } from 'react';
import styles from './data-table.module.css';

export interface DataTableProps {
  /** The table's accessible name, already translated. */
  readonly label: string;
  /** `<thead>` and `<tbody>`, written by the caller so each surface keeps its own columns. */
  readonly children: ReactNode;
}

/**
 * The panel's table frame: a rounded, bordered card with a shaded header row and
 * hairline dividers.
 *
 * A real `<table>`, not a grid of divs — these are rows of related fields under
 * column headings, and a table is what lets assistive technology say which
 * column a cell belongs to. The frame scrolls sideways on its own when the
 * columns cannot fit, so a narrow screen scrolls the table rather than the page
 * (WCAG 1.4.10 reflow).
 *
 * That scrolling is why the frame is a tab stop. A region that only a pointer
 * can scroll hides whatever is off its right-hand edge from anyone driving the
 * app by keyboard (WCAG 2.1.1) — and since the frame is named by the table it
 * holds, landing on it says which table you are about to scroll.
 */
export function DataTable({ label, children }: DataTableProps) {
  return (
    <div className={styles.frame} tabIndex={0} role="group" aria-label={label}>
      <table aria-label={label} className={styles.table}>
        {children}
      </table>
    </div>
  );
}
