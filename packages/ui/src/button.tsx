import type { ButtonHTMLAttributes } from 'react';
import styles from './button.module.css';

export type ButtonVariant = 'brand' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual weight (design system): brand = primary, ghost = secondary, danger = destructive. */
  readonly variant?: ButtonVariant;
  /** Full-width, e.g. a form's primary submit. */
  readonly block?: boolean;
}

/**
 * The shared button. A real, semantic <button> (never a clickable div) so it is
 * keyboard-operable and screen-reader-announced by default (design.md §11C), with
 * a visible :focus-visible ring from the tokens. Defaults `type` to "button" to
 * avoid accidental form submits — pass type="submit" for a form's primary action.
 */
export function Button({
  variant = 'brand',
  block = false,
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  const classes = [styles.btn, styles[variant], block ? styles.block : '', className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={classes} {...props} />;
}
