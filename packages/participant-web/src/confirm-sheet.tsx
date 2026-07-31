import { useEffect, useId, useRef, type KeyboardEvent, type RefObject } from 'react';
import styles from './confirm-sheet.module.css';

/**
 * A decision that cannot be undone, asked for once (screen 9 of the handoff).
 *
 * It is a bottom sheet because the hand holding the phone is at the bottom of
 * it, and because a sent vote is the one thing in this app with no way back —
 * the confirmation is the whole safety net, so it sits where a thumb already is
 * rather than where a desk-shaped dialog would.
 *
 * Three properties are the point, and each is a promise in `taste-and-score`:
 *
 * 1. **The keyboard stays inside.** Tab and Shift+Tab wrap within the sheet's own
 *    controls, so nothing behind it can be reached or pressed while it is open.
 * 2. **The keyboard can leave.** Escape declines — a trap with no key out is a
 *    worse fault than no trap at all.
 * 3. **Nothing else resolves it.** The scrim swallows pointer events and has no
 *    handler of its own. A thumb landing beside the sheet on a phone must not
 *    dismiss the last thing standing between a draft and a sent vote.
 *
 * Focus is put on the sheet itself rather than on either action, so the title is
 * announced whole and no button is armed for a stray Enter. It goes back to
 * whatever opened the sheet when it closes.
 */
export function ConfirmSheet({
  title,
  lead,
  confirmLabel,
  cancelLabel,
  busy = false,
  returnFocusTo,
  onConfirm,
  onCancel,
}: {
  title: string;
  lead?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** While the vote is in flight: both actions are refused, and Escape with them. */
  busy?: boolean;
  /**
   * Where focus goes when the sheet closes. Named rather than inferred: Safari
   * does not focus a button when it is clicked, so on the engine every iPhone
   * runs, "whatever had focus when this opened" is the page body — and closing
   * would drop a participant at the top of the document instead of back on the
   * control they asked from. Falls back to that inference where it is unset.
   */
  returnFocusTo?: RefObject<HTMLElement | null>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const leadId = useId();

  useEffect(() => {
    const inferred = document.activeElement;
    sheet.current?.focus();
    // The ballot behind must not scroll under the sheet — it is not reachable
    // while this is open, so it should not move either.
    const scroll = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = scroll;
      const back = returnFocusTo?.current ?? inferred;
      if (back instanceof HTMLElement && back.isConnected) back.focus();
    };
    // Captured once, on open: the sheet is mounted for one decision and the way
    // back out should not change under it.
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (busy) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;

    /*
     * Every stop is moved by hand, not only the two ends.
     *
     * Safari does not put buttons in its tab order — a Tab pressed on one of
     * these actions moves to the next LINK, which is on the ballot behind the
     * sheet. Correcting only the boundaries therefore holds in Chromium and
     * leaks in WebKit, which is the engine every iPhone at a venue is running.
     * So the sheet takes the key outright and decides where focus goes.
     */
    const stops = [...(sheet.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])];
    event.preventDefault();
    if (stops.length === 0) return; // nothing to move to: stay rather than fall out

    // -1 is the sheet itself, which is where focus starts: forward from it goes
    // to the first action, backward to the last.
    const at = stops.indexOf(document.activeElement as HTMLElement);
    const next = event.shiftKey
      ? at <= 0
        ? stops.length - 1
        : at - 1
      : at === -1 || at === stops.length - 1
        ? 0
        : at + 1;
    stops[next]!.focus();
  }

  return (
    <div className={styles.scrim}>
      <div
        ref={sheet}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={lead ? leadId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {lead ? (
          <p id={leadId} className={styles.lead}>
            {lead}
          </p>
        ) : null}
        <div className={styles.actions}>
          <button type="button" className={styles.confirm} onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </button>
          <button type="button" className={styles.cancel} onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
