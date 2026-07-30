import { useEffect, useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { PanelActionsSlotProvider } from './panel-actions';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';
import { usePanelNav } from './use-panel-nav';
import styles from './panel-shell.module.css';

/**
 * The panel: a navigation that stays put, a header that says where you are, and
 * the surface itself. Every signed-in screen renders inside this, so no surface
 * is a dead end and none of them describes its own place in the panel.
 *
 * The surface keeps its own `<main id="main">` — one landmark per screen, and the
 * skip link still lands on it, which is past the navigation rather than inside
 * it.
 */
export function PanelShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const nav = usePanelNav();
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(false);
  // The header's container for whatever actions the surface below wants there.
  // A ref callback rather than `useRef`, because the surface renders into it and
  // needs to re-render once it exists.
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null);
  const navId = useId();

  // On a narrow screen the navigation is a disclosure. Following a way in should
  // put the host on the surface they asked for, not leave the panel covering it.
  useEffect(() => setOpen(false), [pathname, search]);

  return (
    <div className={styles.shell}>
      <button
        type="button"
        className={styles.disclosure}
        aria-expanded={open}
        aria-controls={navId}
        onClick={() => setOpen((was) => !was)}
      >
        <span aria-hidden="true">☰</span> {t('shell.navigation')}
      </button>

      <nav
        id={navId}
        aria-label={t('shell.navigation')}
        className={`${styles.nav} ${open ? styles.navOpen : ''}`}
      >
        <Sidebar nav={nav} />
      </nav>

      <div className={styles.body}>
        <TopBar nav={nav} actionSlotRef={setActionSlot} />
        <div className={styles.surface}>
          <PanelActionsSlotProvider slot={actionSlot}>{children}</PanelActionsSlotProvider>
        </div>
      </div>
    </div>
  );
}
