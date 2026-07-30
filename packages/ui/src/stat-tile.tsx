import styles from './stat-tile.module.css';

/** The token family a tile is tinted with — matching the progress it belongs to. */
export type StatTone = 'neutral' | 'good' | 'pending';

export interface StatTileProps {
  readonly value: number;
  /** What the number counts, already translated. */
  readonly label: string;
  readonly tone?: StatTone;
}

/**
 * One number and what it counts. The label is a real label, not a caption: the
 * number alone tells a screen-reader user nothing, so the two are read together.
 */
export function StatTile({ value, label, tone = 'neutral' }: StatTileProps) {
  return (
    <div className={`${styles.tile} ${styles[tone]}`}>
      <div className={styles.value}>{value}</div>
      <div className={styles.label}>{label}</div>
    </div>
  );
}
