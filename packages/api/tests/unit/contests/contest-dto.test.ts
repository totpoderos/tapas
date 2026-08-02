import { describe, expect, it } from 'vitest';
import { toContestDto } from '../../../src/contests/contest-dto.js';
import type { StoredContest } from '../../../src/index.js';

const PARTICIPANT_ORIGIN = 'https://join.sobremesa.es';

function contest(): StoredContest {
  return {
    id: 'contest-1',
    hostId: 'host-1',
    name: 'Summer',
    joinCode: 'JOIN-1',
    status: 'live',
    materialized: {
      dishes: [
        { id: 'D-ana', submitterIds: ['ana'] },
        { id: 'D-bob', submitterIds: ['bob'] },
      ],
      allowedVoters: new Map([
        ['D-ana', new Set(['bob'])],
        ['D-bob', new Set(['ana'])],
      ]),
      scoreRangeByVoter: new Map([
        ['ana', { min: 1, max: 5 }],
        ['bob', { min: 1, max: 5 }],
      ]),
      uniquePerCategory: false,
      categories: [{ id: 'taste', name: 'Taste' }],
    },
    closeRule: { when: 'host_trigger' },
    revealStrategy: { when: 'host_trigger' },
    createdAt: '2026-07-19T10:00:00.000Z',
    closedAt: null,
    revealedAt: null,
  };
}

describe('toContestDto', () => {
  it('flattens allowedVoters and scoreRangeByVoter into plain objects', () => {
    const dto = toContestDto(contest(), PARTICIPANT_ORIGIN);

    expect(dto.materialized.allowedVoters).toEqual({ 'D-ana': ['bob'], 'D-bob': ['ana'] });
    expect(dto.materialized.scoreRangeByVoter).toEqual({
      ana: { min: 1, max: 5 },
      bob: { min: 1, max: 5 },
    });
  });

  it('survives a round trip through JSON.stringify, unlike the raw Maps', () => {
    const dto = toContestDto(contest(), PARTICIPANT_ORIGIN);

    const roundTripped = JSON.parse(JSON.stringify(dto));

    expect(roundTripped.materialized.allowedVoters['D-ana']).toEqual(['bob']);
    expect(roundTripped.materialized.scoreRangeByVoter.ana).toEqual({ min: 1, max: 5 });
  });

  it('leaves every other field untouched', () => {
    const dto = toContestDto(contest(), PARTICIPANT_ORIGIN);

    expect(dto.id).toBe('contest-1');
    expect(dto.status).toBe('live');
    expect(dto.joinCode).toBe('JOIN-1');
    expect(dto.materialized.dishes).toEqual(contest().materialized.dishes);
    expect(dto.materialized.categories).toEqual(contest().materialized.categories);
  });

  it('reports the link that joins the contest, beside the code it carries', () => {
    const dto = toContestDto(contest(), PARTICIPANT_ORIGIN);

    // Composed here so that every host-facing read of a whole contest — by id, by
    // name, and the close and reveal answers — passes the one seam and cannot
    // disagree about what the link is.
    expect(dto.joinUrl).toBe('https://join.sobremesa.es/j/JOIN-1');
    expect(dto.joinCode).toBe('JOIN-1');
  });

  it('builds the link from the address it is given, not from a baked-in one', () => {
    const dto = toContestDto(contest(), 'https://tapas.example.org');

    // The address is a deployment fact: the same contest read from two
    // deployments has two different links.
    expect(dto.joinUrl).toBe('https://tapas.example.org/j/JOIN-1');
  });
});
