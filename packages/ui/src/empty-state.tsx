import type { ReactNode } from 'react';
import styles from './empty-state.module.css';

export interface EmptyStateProps {
  /** What there is none of, said plainly and already translated. */
  readonly lead: string;
  /** What to do about it. */
  readonly note?: string;
  /** The way to do it — a button or a link that reads as one. */
  readonly children?: ReactNode;
}

/**
 * Nothing here yet, drawn as an invitation rather than a blank frame: a surface
 * with no rows still tells the host what it is for and offers the first step
 * (Nielsen — an empty state is a dead end only if you let it be).
 */
export function EmptyState({ lead, note, children }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <p className={styles.lead}>{lead}</p>
      {note && <p className={styles.note}>{note}</p>}
      {children}
    </div>
  );
}
