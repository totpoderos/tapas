import type { ReactNode } from 'react';
import styles from './callout.module.css';

export type CalloutTone = 'saffron' | 'danger' | 'neutral' | 'brand';

export interface CalloutProps {
  readonly tone: CalloutTone;
  /** An optional lead line, already translated. */
  readonly title?: string;
  readonly children: ReactNode;
  /**
   * The live-region role, when the callout carries something that appeared
   * because of what the host just did: `alert` for a failure, `status` for a
   * quieter outcome. Left off for a note that was always on the screen.
   */
  readonly role?: 'alert' | 'status';
}

/**
 * A tinted note beside or above the work: a warning before publishing, a
 * failure with a way out, a link shown only once. Shared so the same news
 * always looks the same, in either theme.
 */
export function Callout({ tone, title, children, role }: CalloutProps) {
  return (
    <div role={role} className={`${styles.callout} ${styles[tone]}`}>
      {title && <p className={styles.title}>{title}</p>}
      <div className={styles.body}>{children}</div>
    </div>
  );
}
