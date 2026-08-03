import type { ContestFormat, DraftContent, Person } from '@tapas/domain';
import { draftDetailsOf, type ContestDetailsResult } from '../../contests/contest-details.js';
import type { ResolveContestByName } from '../../contests/use-cases/resolve-contest-by-name.js';
import type { DraftRepository } from '../../db/draft-repository.js';
import type { UpdateDraft } from './update-draft.js';

export interface SettleDraftPeopleDeps {
  readonly resolveContestByName: ResolveContestByName;
  readonly drafts: DraftRepository;
  readonly updateDraft: UpdateDraft;
}

export type PeopleFailureCode = 'NOBODY_BY_THAT_NAME' | 'SEVERAL_BY_THAT_NAME' | 'PARTNER_OF_THEMSELVES';

export interface PeopleFailure {
  readonly code: PeopleFailureCode;
  readonly message: string;
}

export type PeopleChangeResult =
  | { readonly ok: true; readonly result: ContestDetailsResult }
  | { readonly ok: false; readonly error: PeopleFailure };

/** Resolves a contest name to one of the host's drafts and loads it. Drafts only. */
async function resolveDraft(
  deps: SettleDraftPeopleDeps,
  hostId: string,
  contestName: string,
): Promise<{ readonly id: string; readonly content: DraftContent } | ContestDetailsResult> {
  const resolved = await deps.resolveContestByName.execute(hostId, contestName, { only: 'draft' });
  if (resolved.kind !== 'one') {
    return { candidates: resolved.kind === 'several' ? resolved.candidates : [] };
  }
  const only = await deps.drafts.findById(resolved.contest.id);
  if (!only) return { candidates: [] };
  return { id: only.id, content: only.content };
}

/** Applies one change to a draft's people or format and saves it. */
async function changePeople(
  deps: SettleDraftPeopleDeps,
  hostId: string,
  contestName: string,
  change: (content: DraftContent) => DraftContent | PeopleFailure,
): Promise<PeopleChangeResult> {
  const resolved = await resolveDraft(deps, hostId, contestName);
  if (!('content' in resolved)) return { ok: true, result: resolved };

  const changed = change(resolved.content);
  if ('code' in changed) return { ok: false, error: changed };

  const saved = await deps.updateDraft.execute(resolved.id, hostId, changed);
  return { ok: true, result: { details: draftDetailsOf(resolved.id, saved.ok ? changed : resolved.content) } };
}

/**
 * Finds exactly the person a host meant, by the name they said.
 *
 * A display name is an address here, the way a contest name is one — and it is
 * no more unique. Two people called "Ana" make the name useless as an address,
 * so the host is asked rather than one of them being picked; nobody by that name
 * is said plainly. Participant ids stay internal throughout.
 */
function findPerson(people: readonly Person[], displayName: string): Person | PeopleFailure {
  const wanted = displayName.trim().toLowerCase();
  const matches = people.filter((p) => p.displayName.trim().toLowerCase() === wanted);
  if (matches.length === 1) return matches[0]!;
  if (matches.length === 0) {
    return { code: 'NOBODY_BY_THAT_NAME', message: `Nobody called "${displayName.trim()}" is taking part.` };
  }
  return {
    code: 'SEVERAL_BY_THAT_NAME',
    message: `More than one person taking part is called "${displayName.trim()}" — which one do you mean?`,
  };
}

/**
 * Says what kind of contest a draft is: who cooks, and who may not score whom.
 *
 * A format its people cannot yet satisfy — couples, while somebody is still
 * unpaired — is settled rather than refused. That is an ordinary halfway state
 * on the way to a finished draft, and it is what publishing checks, for the form
 * and for the assistant alike. A format that is not one of the three is refused,
 * by the domain, wherever the draft is written.
 */
export class SetDraftFormat {
  constructor(private readonly deps: SettleDraftPeopleDeps) {}

  async execute(hostId: string, contestName: string, format: ContestFormat): Promise<PeopleChangeResult> {
    return await changePeople(this.deps, hostId, contestName, (content) => ({ ...content, format }));
  }
}

/**
 * Pairs two of a draft's people as partners, or leaves one of them without a
 * partner.
 *
 * Always on both people at once. A partnership one of them does not know about
 * is a draft that publishing rejects as not reciprocal, with a reason the host
 * cannot connect to anything they asked for — so pairing Ana with Carmen frees
 * whoever Ana and Carmen were with, and unpairing Ana frees her partner too.
 * That is the half a host never says out loud, and the whole reason this is one
 * operation rather than two.
 */
export class SetDraftPartner {
  constructor(private readonly deps: SettleDraftPeopleDeps) {}

  /** `partnerName` of `null` leaves `personName` without a partner. */
  async execute(
    hostId: string,
    contestName: string,
    personName: string,
    partnerName: string | null,
  ): Promise<PeopleChangeResult> {
    return await changePeople(this.deps, hostId, contestName, (content) => {
      const people = content.participants ?? [];

      const person = findPerson(people, personName);
      if ('code' in person) return person;

      const partner = partnerName === null ? null : findPerson(people, partnerName);
      if (partner && 'code' in partner) return partner;

      if (partner && partner.id === person.id) {
        return {
          code: 'PARTNER_OF_THEMSELVES',
          message: `"${person.displayName}" cannot be their own partner.`,
        };
      }

      /*
       * Whoever the two are leaving. Clearing them is what keeps every
       * partnership in the draft reciprocal — the invariant publishing checks,
       * and the one a host has no way to maintain by hand because they never say
       * this half out loud.
       */
      const leftBehind = new Set(
        [person.partnerId, partner?.partnerId].filter((id): id is string => typeof id === 'string'),
      );

      const participants = people.map((p) => {
        if (p.id === person.id) return withPartner(p, partner?.id ?? undefined);
        if (partner && p.id === partner.id) return withPartner(p, person.id);
        return leftBehind.has(p.id) ? withPartner(p, undefined) : p;
      });

      return { ...content, participants };
    });
  }
}

/** A person with their partner set, or with none — `partnerId` absent rather than undefined. */
function withPartner(person: Person, partnerId: string | undefined): Person {
  const { partnerId: _was, ...rest } = person;
  return partnerId === undefined ? rest : { ...rest, partnerId };
}
