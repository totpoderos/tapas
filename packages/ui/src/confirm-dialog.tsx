import { useEffect, useId, useRef, useState } from 'react';
import { Button } from './button';
import { FormField } from './form-field';
import styles from './confirm-dialog.module.css';

export interface ConfirmDialogProps {
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly workingLabel: string;
  readonly busy: boolean;
  readonly variant?: 'danger' | 'brand';
  /**
   * When given, the action stays locked until the host reproduces this exact
   * text. Use it when confirming destroys work that is not the host's own — a
   * single mis-click should not be able to do that.
   */
  readonly verify?: {
    readonly expected: string;
    readonly label: string;
    readonly hint?: string;
  };
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * A focus-trapped confirmation before an irreversible action (design.md §7.1).
 * Escape cancels, Tab cycles within the dialog, and focus lands inside on open.
 *
 * Its strings are passed in rather than looked up: the two apps name these
 * actions differently, and a shared component that resolved its own keys would
 * announce the raw key whenever an app had not defined it — which has already
 * happened here once (`LanguageSelect` reading out "language.label").
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  workingLabel,
  busy,
  variant = 'danger',
  verify,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState('');
  const titleId = useId();
  const bodyId = useId();
  const verifyId = useId();

  const locked = verify !== undefined && typed.trim() !== verify.expected;

  useEffect(() => {
    const dialog = dialogRef.current;
    // Focus the field when there is one to fill in, otherwise the first button.
    (
      dialog?.querySelector<HTMLElement>('input') ??
      dialog?.querySelector<HTMLButtonElement>('button')
    )?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      // Inputs join the trap too, or Tab would escape a dialog that has one — and
      // DISABLED controls must be excluded: while the typed name does not match,
      // the confirm button is disabled and therefore not focusable, so treating it
      // as the last stop would let Tab fall straight out of the dialog.
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button, input')].filter(
        (element) => !element.hasAttribute('disabled'),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div className={styles.backdrop}>
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className={styles.card}
      >
        <h2 id={titleId} className={styles.cardTitle}>
          {title}
        </h2>
        <p id={bodyId} className={styles.cardBody}>
          {body}
        </p>

        {verify && (
          <div className={styles.verify}>
            <FormField
              id={verifyId}
              label={verify.label}
              hint={verify.hint}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        )}

        <div className={styles.cardActions}>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} disabled={busy || locked}>
            {busy ? workingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
