import { Link } from 'react-router-dom';
import styles from './home.module.css';

/**
 * Where "New contest" lands. The creation form is its own slice (5B.3); for now
 * this is a real, reachable destination so the affordance is never a dead end.
 */
export function NewContest() {
  return (
    <main id="main" className={styles.page}>
      <div className={styles.bar}>
        <div className={styles.brand}>
          <span className={styles.dot} aria-hidden="true" />
          <b>Tapas</b>
        </div>
        <Link to="/" className={styles.newButton}>
          Back to contests
        </Link>
      </div>
      <h1 className={styles.title}>New contest</h1>
      <p className={styles.note}>The contest creation form is coming next.</p>
    </main>
  );
}
