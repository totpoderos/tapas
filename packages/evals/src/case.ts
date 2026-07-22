import { z } from 'zod';

/**
 * The fields a contest-creation case can make claims about — the same field
 * names the assistant proposes (design.md §10.1). Kept as a local list rather
 * than derived from the tool schema so that a change to the tool is a
 * deliberate, visible change to the eval set too.
 */
export const FIELD_NAMES = [
  'name',
  'attribution',
  'antiBias',
  'scoring',
  'participants',
  'closeRule',
  'revealStrategy',
] as const;

export type FieldName = (typeof FIELD_NAMES)[number];

export const CATEGORIES = ['simple', 'domain', 'partial_clarify', 'adversarial'] as const;
export type Category = (typeof CATEGORIES)[number];

const FieldNameSchema = z.enum(FIELD_NAMES);

/**
 * What a turn is expected to produce. Ground truth asserts **values, not
 * source tags**: whether a model calls something `host` or `llm_extracted` is
 * subjective, and pinning it would make cases brittle for no measurement gain.
 */
export const ExpectationSchema = z
  .object({
    /** Expected value for each field the case makes a claim about. */
    fields: z.record(FieldNameSchema, z.unknown()).default({}),
    /** Fields the assistant should be asking the host about. */
    clarifiesAbout: z.array(FieldNameSchema).default([]),
    /**
     * Fields that must NOT appear — the sole input to false-field rate. A
     * field being absent from `fields` means "this case makes no claim", not
     * "this must not appear"; anything forbidden has to be said outright.
     */
    absent: z.array(FieldNameSchema).default([]),
  })
  .strict();

export type Expectation = z.infer<typeof ExpectationSchema>;

/**
 * One host message and what it should produce. Turn 1 is an extraction; every
 * later turn is a merge, with the previous turn's draft and clarifications fed
 * back in — exactly what the host's client does (design.md §8).
 */
export const EvalTurnSchema = z
  .object({
    message: z.string().min(1),
    expect: ExpectationSchema,
  })
  .strict();

export type EvalTurn = z.infer<typeof EvalTurnSchema>;

export const EvalCaseSchema = z
  .object({
    id: z.string().min(1),
    category: z.enum(CATEGORIES),
    /** Why this case exists — read by whoever inspects a regression later. */
    note: z.string().optional(),
    turns: z.array(EvalTurnSchema).min(1),
  })
  .strict();

export type EvalCase = z.infer<typeof EvalCaseSchema>;

/** Validates a case set at load time, so a malformed case fails loudly rather than skewing a metric. */
export function parseCases(cases: readonly unknown[]): EvalCase[] {
  return cases.map((raw, index) => {
    const parsed = EvalCaseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Eval case at index ${index} is invalid: ${parsed.error.message}`);
    }
    return parsed.data;
  });
}
