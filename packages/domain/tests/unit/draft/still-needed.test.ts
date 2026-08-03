import { describe, expect, it } from 'vitest';
import { stillNeeded } from '../../../src/draft/still-needed.js';
import type { DraftContent } from '../../../src/draft/draft-content.js';

const READY: DraftContent = {
  name: 'Tapas Night',
  format: 'solo',
  participants: [{ id: 'a', displayName: 'Ana' }],
  scoring: {
    categories: [{ id: 'c1', name: 'Taste' }],
    range: { type: 'fixed', min: 1, max: 5 },
    uniquePerCategory: false,
  },
};

/** The same draft with one thing unsaid, as a host leaves it mid-way. */
function without(part: keyof DraftContent): DraftContent {
  const { [part]: _unsaid, ...rest } = READY;
  return rest as DraftContent;
}

describe('what a draft still needs', () => {
  it('is nothing once the draft says all three', () => {
    expect(stillNeeded(READY)).toEqual([]);
  });

  it('names the kind of contest when it has not been said', () => {
    expect(stillNeeded(without('format'))).toEqual(['format']);
  });

  it('names who is taking part when nobody has been added', () => {
    expect(stillNeeded(without('participants'))).toEqual(['participants']);
  });

  it('names how it is scored when the scoring has not been settled', () => {
    expect(stillNeeded(without('scoring'))).toEqual(['scoring']);
  });

  it('names all three for a draft that is only a name', () => {
    expect(stillNeeded({ name: 'Tapas' })).toEqual(['format', 'participants', 'scoring']);
  });

  /*
   * The order a host builds a contest in, not the order the fields happen to sit
   * in. A list read out to someone has to be in some order, and this is the one
   * that reads as a sequence of decisions rather than as a dump of fields.
   */
  it('names them in the order a contest is built', () => {
    expect(stillNeeded({ name: 'Tapas', participants: [{ id: 'a', displayName: 'Ana' }] })).toEqual([
      'format',
      'scoring',
    ]);
  });

  /*
   * A draft carrying an empty participant list has said who is taking part —
   * nobody — which is a different thing from not having said. Publishing refuses
   * it, but for having nobody in it, and that is the refusal the host needs to
   * read. Saying it "still needs who is taking part" would send them to add
   * people they may have deliberately just removed.
   */
  it('treats an empty list of people as said, not as unsaid', () => {
    expect(stillNeeded({ ...READY, participants: [] })).toEqual([]);
  });
});
