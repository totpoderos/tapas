import type { ButtonHTMLAttributes } from 'react';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * The shared button. A real, semantic <button> (never a clickable div) so it
 * is keyboard-operable and screen-reader-announced by default (design.md §11C).
 * Defaults `type` to "button" to avoid accidental form submits. Styling
 * (tokens, focus-visible) is layered in Phase 5.
 */
export function Button({ type = 'button', ...props }: ButtonProps) {
  return <button type={type} {...props} />;
}
