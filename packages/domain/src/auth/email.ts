export interface EmailError {
  readonly code: 'INVALID_EMAIL';
  readonly message: string;
}

export type EmailResult =
  | { readonly ok: true; readonly email: Email }
  | { readonly ok: false; readonly error: EmailError };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A validated, normalised (lower-cased, trimmed) email address. */
export class Email {
  private constructor(readonly value: string) {}

  static create(raw: string): EmailResult {
    const normalized = raw.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      return { ok: false, error: { code: 'INVALID_EMAIL', message: 'That is not a valid email address.' } };
    }
    return { ok: true, email: new Email(normalized) };
  }
}
