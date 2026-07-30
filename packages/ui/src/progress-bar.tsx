import styles from './progress-bar.module.css';

/** One stretch of a progress bar: how much of the whole, and in what tone. */
export interface ProgressSegment {
  /** A fraction of the whole, 0–1. Anything past the total is clamped by the sum. */
  readonly of: number;
  readonly tone: 'good' | 'pending' | 'brand';
}

export interface ProgressBarProps {
  /** The stretches, in order. Whatever they do not add up to is left unfilled. */
  readonly segments: readonly ProgressSegment[];
  /**
   * What the bar says, in words, already translated — "13 of 18 votes sent".
   *
   * Required, not optional. The bar is the illustration and this is the fact: a
   * host reading with a screen reader, or unable to tell the tones apart, gets
   * the same answer either way (design.md §11C — never colour or shape alone).
   */
  readonly label: string;
}

/**
 * How far along something is. Drawn as a bar and stated in words, with the words
 * being what assistive technology reads: the bar itself is hidden from it, since
 * a decorative div announced as "13%" is worse than silence.
 */
export function ProgressBar({ segments, label }: ProgressBarProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.track} aria-hidden="true">
        {segments.map((segment, i) => (
          <span
            key={i}
            className={`${styles.fill} ${styles[segment.tone]}`}
            style={{ width: `${Math.max(0, Math.min(1, segment.of)) * 100}%` }}
          />
        ))}
      </div>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
