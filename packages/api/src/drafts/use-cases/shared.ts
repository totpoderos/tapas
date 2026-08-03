import type { DraftContent } from '@tapas/domain';
import type { Clock, IdGenerator } from '../../audit/audit-projection.js';
import type { AuditRecorder } from '../../audit/audit-recorder.js';
import type { DraftRepository } from '../../db/draft-repository.js';
import type { StoredDraft } from '../stored-draft.js';

export type DraftFailureCode = 'NAME_REQUIRED' | 'UNKNOWN_FORMAT' | 'DRAFT_NOT_FOUND';

export interface DraftFailure {
  readonly code: DraftFailureCode;
  readonly message: string;
}

/** Dependencies for the write use cases. Queries take only the repository. */
export interface DraftUseCaseDeps {
  readonly drafts: DraftRepository;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

export type DraftWriteResult =
  | { readonly ok: true; readonly draft: StoredDraft }
  | { readonly ok: false; readonly error: DraftFailure };

export const draftNotFound: DraftFailure = { code: 'DRAFT_NOT_FOUND', message: 'No such draft.' };

/** Ownership check (OWASP A01): returns the draft only if it belongs to the host. */
export async function findOwnedDraft(
  drafts: DraftRepository,
  draftId: string,
  hostId: string,
): Promise<StoredDraft | undefined> {
  const draft = await drafts.findById(draftId);
  return draft && draft.hostId === hostId ? draft : undefined;
}

/**
 * Gives every participant an id, keeping the ones that already have one.
 *
 * A participant's id is internal identity, not something the host states: the
 * form generates one per row, and `AddDraftParticipant` mints one when a host
 * says "add Paco". A draft arriving from the assistant has neither — a model
 * asked for "two participants: Juan and Paco" sends names, because an id is not
 * its to invent. Left alone, those participants were stored with `id:
 * undefined`, which made them unaddressable (nothing could name them as a partner) and
 * failed publish with `DUPLICATE_PERSON_ID "undefined"` as soon as there were
 * two of them. Assigning ids here — where every write path already passes —
 * keeps that impossible however the draft was authored.
 *
 * Existing ids are preserved so an edit keeps referring to the same people, and
 * so `partnerId` references stay intact.
 */
export function withParticipantIds(content: DraftContent, ids: IdGenerator): DraftContent {
  if (!content.participants?.length) return content;
  return {
    ...content,
    participants: content.participants.map((person) =>
      person.id ? person : { ...person, id: ids.next() },
    ),
  };
}

/**
 * The same for what a contest is judged on, and for the same reason.
 *
 * A category's id is internal identity — a score is kept against it and the
 * tally gathers by matching it — and identity is not the author's to invent.
 * `AddScoringCategory` mints one when a host says "judge it on Presentation";
 * the two forms used to derive one from the row's position; and a model asked
 * for "judged on Taste and Originality" has none to give, because the host has
 * never been shown one.
 *
 * Assigning it here — the one place every draft write already passes — means no
 * caller has to remember to, and the next authoring path added gets it for free.
 * Existing ids are kept, so an edit goes on referring to the same categories
 * rather than quietly making new ones.
 *
 * Publishing is what checks the result is coherent: two categories that are one
 * thing underneath are refused there (`DUPLICATE_CATEGORY_ID`), not laundered
 * into two by a re-mint on the way past.
 */
export function withCategoryIds(content: DraftContent, ids: IdGenerator): DraftContent {
  const categories = content.scoring?.categories;
  if (!categories?.length) return content;
  return {
    ...content,
    scoring: {
      ...content.scoring!,
      categories: categories.map((category) =>
        category.id ? category : { ...category, id: ids.next() },
      ),
    },
  };
}

/** Both, in the order a draft write wants them. Neither caller should have to remember there are two. */
export function withAssignedIds(content: DraftContent, ids: IdGenerator): DraftContent {
  return withCategoryIds(withParticipantIds(content, ids), ids);
}
