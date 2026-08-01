import { compile } from '@tapas/domain';
import { describe, expect, it } from 'vitest';
import { deserializeMaterialized, serializeMaterialized } from '../../../src/index.js';

function person(id: string, partnerId: string) {
  return { id, displayName: id, partnerId };
}

describe('materialized codec', () => {
  it('round-trips a compiled contest (Maps/Sets survive serialization)', () => {
    const compiled = compile({
      format: 'solo_with_partners',
      scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'auto' }, uniquePerCategory: true },
      participants: [person('A', 'B'), person('B', 'A'), person('C', 'D'), person('D', 'C')],
    });
    if (!compiled.ok) throw new Error('expected compile success');

    const restored = deserializeMaterialized(serializeMaterialized(compiled.contest));

    expect(restored).toEqual(compiled.contest);
  });
});
