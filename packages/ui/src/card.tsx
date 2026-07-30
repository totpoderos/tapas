import { useId, type ReactNode } from 'react';
import styles from './card.module.css';

export interface CardProps {
  /** The card's heading, already translated. Omitted for a card that is just a panel. */
  readonly title?: string;
  /** A quieter line beside the heading — a count, a state, a caveat. */
  readonly aside?: ReactNode;
  /** The heading level, so a surface's headings stay in order. Defaults to 2. */
  readonly level?: 2 | 3;
  readonly children: ReactNode;
}

/**
 * A panel on the panel: the bordered, rounded surface the design lays every group
 * of related things onto.
 *
 * The heading level is a prop rather than fixed, because a card nested inside
 * another surface's section must not skip a level — a screen reader user
 * navigating by heading gets a broken outline if it does.
 *
 * A titled card is a *named* region: the heading labels the section, so assistive
 * technology can move between the panels of a surface the way an eye does. A
 * `<section>` with no accessible name is not a region at all, which is the same
 * thing as not having grouped anything.
 */
export function Card({ title, aside, level = 2, children }: CardProps) {
  const Heading = level === 2 ? 'h2' : 'h3';
  const titleId = useId();
  return (
    <section className={styles.card} aria-labelledby={title ? titleId : undefined}>
      {title && (
        <div className={styles.head}>
          <Heading id={titleId} className={styles.title}>
            {title}
          </Heading>
          {aside && <span className={styles.aside}>{aside}</span>}
        </div>
      )}
      {children}
    </section>
  );
}
