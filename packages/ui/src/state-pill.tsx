import type { ReactNode } from 'react';
import styles from './state-pill.module.css';

/** The token families a state can be drawn in. */
export type StateTone = 'good' | 'neutral' | 'pending' | 'saffron' | 'brand' | 'danger';

export interface StatePillProps {
  readonly tone: StateTone;
  /**
   * A shape that stands for the state (● ◇ ◆ ✓). Decorative and hidden from
   * assistive technology — the word beside it is what is read — but it is what
   * makes the state legible to someone who cannot tell the tones apart
   * (design.md §11C: colour is never the sole signal).
   */
  readonly mark?: string;
  readonly children: ReactNode;
}

/**
 * A state, said in a word, marked with a shape, and tinted with a tone. Shared
 * because every host surface shows the same states and they must read
 * identically on all of them.
 *
 * The word is passed in, already translated: a shared component that resolved
 * its own keys would announce the raw key in any app that had not defined it.
 */
export function StatePill({ tone, mark, children }: StatePillProps) {
  return (
    <span className={`${styles.pill} ${styles[tone]}`}>
      {mark && (
        <span aria-hidden="true" className={styles.mark}>
          {mark}
        </span>
      )}
      {children}
    </span>
  );
}
