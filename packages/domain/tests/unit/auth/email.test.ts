import { describe, expect, it } from 'vitest';
import { Email } from '../../../src/index.js';

describe('Email', () => {
  it('accepts and normalises a valid email', () => {
    const result = Email.create('  Ana@Example.COM ');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.email.value).toBe('ana@example.com');
  });

  it('rejects a malformed email', () => {
    const result = Email.create('not-an-email');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_EMAIL');
  });
});
