import { Button } from '@tapas/ui';
import { useSession } from '../auth/session';
import styles from './home.module.css';

/**
 * The signed-in landing. For this slice it just proves the host is signed in and
 * can sign out; the real contest list, forms and chat panel arrive as their
 * slices land.
 */
export function Home() {
  const { signOut } = useSession();

  return (
    <main id="main" className={styles.page}>
      <div className={styles.bar}>
        <div className={styles.brand}>
          <span className={styles.dot} aria-hidden="true" />
          <b>Tapas</b>
        </div>
        <Button variant="ghost" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
      <h1 className={styles.title}>You’re signed in</h1>
      <p className={styles.lead}>
        Welcome back. This is where your contests will live — the list, the creation form, the chat
        assistant, and the live controls.
      </p>
      <div className={styles.placeholder}>Your contests will appear here.</div>
    </main>
  );
}
