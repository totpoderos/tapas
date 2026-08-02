import { describe, expect, it } from 'vitest';
import { joinLinkFor } from '../../../src/contests/join-link.js';

/**
 * The link a contest is joined by: where the participant app answers, carrying
 * the join code, so that following it asks nobody to type anything.
 *
 * It is the one place that knows the participant app's deep-link shape, which is
 * why that shape is pinned here rather than left to whoever composes a response.
 */
describe('joinLinkFor', () => {
  it('carries the join code to where people join', () => {
    expect(joinLinkFor('https://join.sobremesa.es', '4KQ207')).toBe(
      'https://join.sobremesa.es/j/4KQ207',
    );
  });

  it('does not double the separator when the address ends in one', () => {
    // A deployment writing PARTICIPANT_WEB_ORIGIN with a trailing slash is not a
    // misconfiguration, and `//j/` is not the same path to every server.
    expect(joinLinkFor('https://join.sobremesa.es/', '4KQ207')).toBe(
      'https://join.sobremesa.es/j/4KQ207',
    );
  });

  it('leaves the join code exactly as it was issued', () => {
    // Codes are uppercase, and the participant app folds case on arrival — but a
    // link that quietly rewrote the code would make the two disagree about what
    // was scanned, which is worse than either convention.
    expect(joinLinkFor('https://join.sobremesa.es', 'aBc123')).toBe(
      'https://join.sobremesa.es/j/aBc123',
    );
  });

  it('keeps a path the address already has', () => {
    // A deployment serving the participant app under a sub-path is not something
    // this can drop on the floor; only the trailing slash is normalised.
    expect(joinLinkFor('https://sobremesa.es/join/', '4KQ207')).toBe(
      'https://sobremesa.es/join/j/4KQ207',
    );
  });

  it('escapes a code that would otherwise change the address', () => {
    /*
     * Join codes are generated uppercase alphanumeric, so this cannot happen from
     * the generator. It is pinned anyway: the code reaches here as a string, and a
     * link built by gluing strings together is exactly where a `../` or a `?`
     * would quietly point the whole room somewhere else.
     */
    expect(joinLinkFor('https://join.sobremesa.es', '../evil')).toBe(
      'https://join.sobremesa.es/j/..%2Fevil',
    );
    expect(joinLinkFor('https://join.sobremesa.es', 'A?B#C')).toBe(
      'https://join.sobremesa.es/j/A%3FB%23C',
    );
  });
});
