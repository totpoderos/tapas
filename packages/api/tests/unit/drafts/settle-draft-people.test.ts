import { describe, expect, it } from 'vitest';
import type { DraftContent, Person } from '@tapas/domain';
import type { ContestSummary } from '../../../src/contests/contest-summary.js';
import type { FindContestsByName } from '../../../src/contests/use-cases/find-contests-by-name.js';
import { ResolveContestByName } from '../../../src/contests/use-cases/resolve-contest-by-name.js';
import type { DraftRepository } from '../../../src/db/draft-repository.js';
import type { StoredDraft } from '../../../src/drafts/stored-draft.js';
import type { UpdateDraft } from '../../../src/drafts/use-cases/update-draft.js';
import {
  SetDraftFormat,
  SetDraftPartner,
  type SettleDraftPeopleDeps,
} from '../../../src/drafts/use-cases/settle-draft-people.js';

const summary = (id: string, name: string, status: ContestSummary['status'] = 'draft'): ContestSummary => ({
  id,
  name,
  status,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

function workspace(matches: ContestSummary[], initial: DraftContent) {
  let content = initial;
  const drafts = {
    findById: (id: string) => (id === 'd1' ? ({ id, content } as StoredDraft) : undefined),
  } as unknown as DraftRepository;
  const updateDraft = {
    execute: (_id: string, _hostId: string, next: DraftContent) => {
      content = next;
      return { ok: true, draft: { content } as StoredDraft };
    },
  } as unknown as UpdateDraft;
  const deps: SettleDraftPeopleDeps = {
    resolveContestByName: new ResolveContestByName({
      execute: () => matches,
    } as unknown as FindContestsByName),
    drafts,
    updateDraft,
  };
  return { deps, current: () => content };
}

const draftWith = (participants: Person[], extra: Partial<DraftContent> = {}): DraftContent => ({
  name: 'Tapas Night',
  participants,
  ...extra,
});

const person = (id: string, displayName: string, partnerId?: string): Person =>
  partnerId ? { id, displayName, partnerId } : { id, displayName };

/** Who is partnered with whom, by display name, for reading an assertion at a glance. */
function pairings(content: DraftContent): Record<string, string | null> {
  const people = content.participants ?? [];
  const nameOf = (id: string) => (people.find((p) => p.id === id))?.displayName ?? id;
  return Object.fromEntries(people.map((p) => [p.displayName, p.partnerId ? nameOf(p.partnerId) : null]));
}

const ONLY_DRAFT = [summary('d1', 'Tapas Night')];

describe('SetDraftFormat', async () => {
  it('says what kind of contest the draft is', async () => {
    const { deps, current } = workspace(ONLY_DRAFT, draftWith([person('a', 'Ana')], { format: 'solo' }));
    await new SetDraftFormat(deps).execute('h1', 'Tapas Night', 'couples');

    expect(current().format).toBe('couples');
  });

  /*
   * Deliberate. Couples-while-unpaired is an ordinary halfway state on the way
   * to a finished draft — the form allows it and publishing is what refuses it,
   * so refusing here would be a validator the form does not share.
   */
  it('settles a format the people cannot yet satisfy', async () => {
    const { deps, current } = workspace(ONLY_DRAFT, draftWith([person('a', 'Ana'), person('b', 'Bob')]));
    const answer = await new SetDraftFormat(deps).execute('h1', 'Tapas Night', 'couples');

    expect(answer.ok).toBe(true);
    expect(current().format).toBe('couples');
    expect(pairings(current())).toEqual({ Ana: null, Bob: null });
  });

  it('leaves the people and the scoring alone', async () => {
    const { deps, current } = workspace(
      ONLY_DRAFT,
      draftWith([person('a', 'Ana'), person('b', 'Bob')], {
        scoring: { categories: [{ id: 'c0', name: 'Taste' }], range: { type: 'auto' }, uniquePerCategory: false },
      }),
    );
    await new SetDraftFormat(deps).execute('h1', 'Tapas Night', 'couples');

    expect((current().participants ?? []).map((p) => p.displayName)).toEqual(['Ana', 'Bob']);
    expect(current().scoring?.categories.map((c) => c.name)).toEqual(['Taste']);
  });

  it('changes nothing for a name only a published contest has', async () => {
    const { deps, current } = workspace(
      [summary('c1', 'Tapas Night', 'live')],
      draftWith([person('a', 'Ana')], { format: 'solo' }),
    );
    const answer = await new SetDraftFormat(deps).execute('h1', 'Tapas Night', 'couples');

    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    expect(answer.result.candidates).toEqual([]);
    expect(current().format).toBe('solo');
  });
});

describe('SetDraftPartner', async () => {
  it('pairs two people, on both of them', async () => {
    const { deps, current } = workspace(
      ONLY_DRAFT,
      draftWith([person('a', 'Ana'), person('b', 'Bob'), person('c', 'Carmen')]),
    );
    await new SetDraftPartner(deps).execute('h1', 'Tapas Night', 'Ana', 'Bob');

    expect(pairings(current())).toEqual({ Ana: 'Bob', Bob: 'Ana', Carmen: null });
  });

  /*
   * The half a host never says out loud. Left undone, the draft holds a
   * partnership Bob still believes in, which publishing rejects as not
   * reciprocal — with a reason the host cannot connect to what they asked.
   */
  it('frees the partner each of them is leaving', async () => {
    const { deps, current } = workspace(
      ONLY_DRAFT,
      draftWith([
        person('a', 'Ana', 'b'),
        person('b', 'Bob', 'a'),
        person('c', 'Carmen', 'd'),
        person('d', 'Dan', 'c'),
      ]),
    );
    await new SetDraftPartner(deps).execute('h1', 'Tapas Night', 'Ana', 'Carmen');

    expect(pairings(current())).toEqual({ Ana: 'Carmen', Carmen: 'Ana', Bob: null, Dan: null });
  });

  it('leaves somebody without a partner, and frees the one they were with', async () => {
    const { deps, current } = workspace(
      ONLY_DRAFT,
      draftWith([person('a', 'Ana', 'b'), person('b', 'Bob', 'a')]),
    );
    await new SetDraftPartner(deps).execute('h1', 'Tapas Night', 'Ana', null);

    expect(pairings(current())).toEqual({ Ana: null, Bob: null });
  });

  it('every partnership it leaves behind is reciprocal', async () => {
    const { deps, current } = workspace(
      ONLY_DRAFT,
      draftWith([
        person('a', 'Ana', 'b'),
        person('b', 'Bob', 'a'),
        person('c', 'Carmen', 'd'),
        person('d', 'Dan', 'c'),
      ]),
    );
    await new SetDraftPartner(deps).execute('h1', 'Tapas Night', 'Bob', 'Dan');

    const people = current().participants ?? [];
    for (const p of people) {
      if (!p.partnerId) continue;
      expect((people.find((other) => other.id === p.partnerId))?.partnerId).toBe(p.id);
    }
  });

  it('refuses somebody who is not taking part, and changes nothing', async () => {
    const { deps, current } = workspace(ONLY_DRAFT, draftWith([person('a', 'Ana'), person('b', 'Bob')]));
    const answer = await new SetDraftPartner(deps).execute('h1', 'Tapas Night', 'Ana', 'Zoe');

    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    expect(answer.error.code).toBe('NOBODY_BY_THAT_NAME');
    expect(answer.error.message).toContain('Zoe');
    expect(pairings(current())).toEqual({ Ana: null, Bob: null });
  });

  /* A display name is an address, and no more unique than a contest name. */
  it('puts a name two people share back to the host', async () => {
    const { deps, current } = workspace(
      ONLY_DRAFT,
      draftWith([person('a1', 'Ana'), person('a2', 'Ana'), person('b', 'Bob')]),
    );
    const answer = await new SetDraftPartner(deps).execute('h1', 'Tapas Night', 'Ana', 'Bob');

    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    expect(answer.error.code).toBe('SEVERAL_BY_THAT_NAME');
    expect(pairings(current())).toEqual({ Ana: null, Bob: null });
  });

  it('refuses to make somebody their own partner', async () => {
    const { deps, current } = workspace(ONLY_DRAFT, draftWith([person('a', 'Ana'), person('b', 'Bob')]));
    const answer = await new SetDraftPartner(deps).execute('h1', 'Tapas Night', 'Ana', 'Ana');

    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    expect(answer.error.code).toBe('PARTNER_OF_THEMSELVES');
    expect(pairings(current())).toEqual({ Ana: null, Bob: null });
  });

  it('matches a name without regard to case or stray spaces', async () => {
    const { deps, current } = workspace(ONLY_DRAFT, draftWith([person('a', 'Ana'), person('b', 'Bob')]));
    await new SetDraftPartner(deps).execute('h1', 'Tapas Night', ' ana ', 'BOB');

    expect(pairings(current())).toEqual({ Ana: 'Bob', Bob: 'Ana' });
  });

  it('leaves what the draft is judged on alone', async () => {
    const { deps, current } = workspace(
      ONLY_DRAFT,
      draftWith([person('a', 'Ana'), person('b', 'Bob')], {
        scoring: { categories: [{ id: 'c0', name: 'Taste' }], range: { type: 'auto' }, uniquePerCategory: true },
      }),
    );
    await new SetDraftPartner(deps).execute('h1', 'Tapas Night', 'Ana', 'Bob');

    expect(current().scoring?.categories.map((c) => c.name)).toEqual(['Taste']);
    expect(current().scoring?.uniquePerCategory).toBe(true);
  });
});
