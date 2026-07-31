import { Link } from 'react-router';
import { XCircle, Key } from '@phosphor-icons/react/dist/ssr';
import styles from './plain-screen.module.css';

/*
 * Icons are imported per-icon rather than from the package root. The barrel
 * re-exports every icon in the set, and a bundler that cannot tree-shake it
 * ships all of them — which matters here more than most places, because this
 * app is opened on whatever phone somebody brought to a venue.
 */
const ICONS = { gone: XCircle, signedOut: Key } as const;

/**
 * A screen that exists to say there is nothing to do, and to offer the one way
 * out. Two of them: the contest is gone, and the session is not recognised.
 *
 * They share a component because they share a job. Both are dead ends a
 * participant reaches through no fault of their own — one because a host
 * deleted the contest, one because a session lapsed — and in both cases the
 * worst answer is a screen that still looks operable. Retrying cannot succeed,
 * so nothing here invites a retry.
 */
export function PlainScreen({
  kind,
  title,
  lead,
  actionLabel,
  actionTo,
}: {
  kind: keyof typeof ICONS;
  title: string;
  lead: string;
  actionLabel: string;
  actionTo: string;
}) {
  const Icon = ICONS[kind];

  return (
    <main id="main" className={styles.plain}>
      <span className={styles.icon}>
        <Icon size={48} weight="duotone" aria-hidden="true" />
      </span>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.lead}>{lead}</p>
      <Link to={actionTo} className={styles.action}>
        {actionLabel}
      </Link>
    </main>
  );
}
