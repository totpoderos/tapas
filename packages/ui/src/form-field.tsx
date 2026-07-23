import type { InputHTMLAttributes } from 'react';
import styles from './form-field.module.css';

export interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  readonly id: string;
  readonly label: string;
  /** A helper line, associated to the input via aria-describedby. */
  readonly hint?: string;
  /** When set, the field renders invalid: red border, aria-invalid, and an announced error. */
  readonly error?: string;
}

/**
 * The accessible form field both apps share (design.md §11C). The label is bound
 * to the input; a hint and/or error are associated via `aria-describedby`; the
 * error carries `aria-invalid` and `role="alert"` so it is announced the moment
 * it appears; validation surfaces on blur and submit, never mid-keystroke.
 */
export function FormField({ id, label, hint, error, ...input }: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`${styles.field} ${error ? styles.invalid : ''}`}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...input}
      />
      {hint ? (
        <span className={styles.hint} id={hintId}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <p className={styles.error} id={errorId} role="alert">
          <span aria-hidden="true">✕</span>
          {error}
        </p>
      ) : null}
    </div>
  );
}
