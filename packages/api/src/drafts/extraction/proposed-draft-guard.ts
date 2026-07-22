import { z } from 'zod';
import {
  FIELD_SCHEMAS,
  NON_DEFAULTABLE_FIELDS,
  type ProposedDraft,
} from './contest-draft-tool.js';

/** The draft fields of a proposed draft — everything the model proposes except its questions. */
export type ExtractedFields = Omit<ProposedDraft, 'clarifications'>;

/** Plain-language names for the fields, for clarifications a non-technical host reads. */
const FIELD_LABELS: Record<keyof ExtractedFields, string> = {
  name: 'the contest name',
  attribution: 'attribution',
  antiBias: 'the anti-bias rule',
  scoring: 'the scoring rules',
  participants: 'the participants',
  closeRule: 'the close rule',
  revealStrategy: 'the reveal strategy',
};

const FIELD_ORDER = Object.keys(FIELD_LABELS) as (keyof ExtractedFields)[];

const NON_DEFAULTABLE = new Set<string>(NON_DEFAULTABLE_FIELDS);

const ClarificationsSchema = z.array(z.string());

export interface GuardedDraft {
  readonly draft: ExtractedFields;
  readonly clarifications: readonly string[];
}

/** What a tool call yielded, before the "may not default" guard is applied. */
export interface ParsedDraft {
  readonly fields: ExtractedFields;
  readonly clarifications: readonly string[];
}

/**
 * Second half of two-phase validation (design.md §11B.2): the tool's JSON
 * schema bounds the shape structurally, this re-validates what actually came
 * back. Validation is **per field**, not all-or-nothing: a small model that
 * mangles one nested field (a `range` of `null`, say) must not cost the host
 * every other field it got right. A field that fails is dropped and becomes a
 * clarification, which is what the host needs to see anyway.
 *
 * Only known fields are ever read, so anything the model smuggles past the
 * tool schema is discarded rather than propagated. Applying the §9 guard is
 * the caller's job — on the merge path the parsed fields still have to be
 * combined with the prior draft first, and guarding both halves separately
 * would ask the host the same question twice.
 *
 * Returns undefined only when the arguments are not an object at all.
 */
export function parseProposedDraft(args: unknown): ParsedDraft | undefined {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) return undefined;
  const record = args as Record<string, unknown>;

  const parsedClarifications = ClarificationsSchema.safeParse(record.clarifications);
  const clarifications = parsedClarifications.success ? [...parsedClarifications.data] : [];
  const fields: Record<string, unknown> = {};

  for (const key of FIELD_ORDER) {
    if (isUndetermined(record[key])) continue;
    const parsed = FIELD_SCHEMAS[key].safeParse(record[key]);
    if (parsed.success) fields[key] = parsed.data;
    else clarifications.push(`I couldn't make sense of ${FIELD_LABELS[key]} — please tell me again.`);
  }

  return { fields: fields as ExtractedFields, clarifications };
}

/**
 * Models routinely spell "I couldn't determine this" as an explicit null —
 * either for the whole field or for its `value` — rather than by omitting the
 * key. That means the same as leaving it out, and is not worth telling the
 * host their answer was unusable. A field that is *present but malformed*
 * (say, a scoring config with a null range) is a different thing, and does
 * earn a clarification.
 */
function isUndetermined(field: unknown): boolean {
  if (field === undefined || field === null) return true;
  return (
    typeof field === 'object' &&
    'value' in (field as Record<string, unknown>) &&
    (field as Record<string, unknown>).value == null
  );
}

/**
 * Enforces the "may not default" allow-list (design.md §9) over a set of
 * proposed fields: a high-stakes field tagged `llm_default` is dropped and
 * replaced with a clarification, regardless of what the system prompt asked
 * for. Defense in depth — the guard does not depend on the model having
 * followed its instructions, nor (on the merge path) on the caller having
 * sent back an untampered prior draft.
 */
export function guardProposedFields(
  fields: ExtractedFields,
  clarifications: readonly string[],
): GuardedDraft {
  const guardedClarifications = [...clarifications];
  const draft: ExtractedFields = {};

  for (const key of FIELD_ORDER) {
    const field = fields[key];
    if (!field) continue;
    if (NON_DEFAULTABLE.has(key) && field.source === 'llm_default') {
      guardedClarifications.push(
        `Please specify ${FIELD_LABELS[key]} explicitly — I can't default that for you.`,
      );
      continue;
    }
    // Each field is a discriminated `{ value, source }` pair; the loop is
    // uniform over keys, so assign through a widened view of the target.
    (draft as Record<string, unknown>)[key] = field;
  }

  return { draft, clarifications: guardedClarifications };
}
