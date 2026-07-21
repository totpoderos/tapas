import { z } from 'zod';
import type { LLMToolDefinition } from '@tapas/shared';

/**
 * Where a field's value came from: what the host explicitly said, a
 * sensible default the assistant proposed, or something the assistant read
 * off the host's message. The form renders `llm_default` with a visible
 * badge (design.md §9); the audit log records the source at save time.
 */
export const SourceSchema = z.enum(['host', 'llm_default', 'llm_extracted']);
export type Source = z.infer<typeof SourceSchema>;

function field<T extends z.ZodTypeAny>(value: T) {
  return z.object({ value, source: SourceSchema }).strict();
}

const PersonSchema = z
  .object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    partnerId: z.string().min(1).optional(),
    noScoreWith: z.array(z.string().min(1)).optional(),
  })
  .strict();

const ScoreRangeSchema = z.union([
  z.object({ type: z.literal('fixed'), min: z.number(), max: z.number() }).strict(),
  z.object({ type: z.literal('auto') }).strict(),
]);

const ScoringConfigSchema = z
  .object({
    categories: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) }).strict()).min(1),
    range: ScoreRangeSchema,
    uniquePerCategory: z.boolean(),
  })
  .strict();

const CloseRuleSchema = z.union([
  z.object({ when: z.enum(['all_sent', 'host_trigger']) }).strict(),
  z.object({ when: z.literal('scheduled'), at: z.string() }).strict(),
]);

const RevealStrategySchema = z.union([
  z.object({ when: z.literal('host_trigger') }).strict(),
  z.object({ when: z.literal('scheduled'), at: z.string() }).strict(),
]);

/**
 * The extraction tool's output shape: every `DraftContent` field, optional
 * and tagged with its source, plus the clarifications the assistant needs
 * from the host. Re-validated here after the LLM call (design.md §11B.2:
 * the tool schema bounds the shape structurally, Zod re-validates it) — the
 * schema alone is not trusted to have been honored.
 */
export const ProposedDraftSchema = z
  .object({
    name: field(z.string().min(1)).optional(),
    attribution: field(z.enum(['per_person', 'per_couple'])).optional(),
    antiBias: field(z.enum(['none', 'couples', 'arbitrary_pairs'])).optional(),
    scoring: field(ScoringConfigSchema).optional(),
    participants: field(z.array(PersonSchema).min(1)).optional(),
    closeRule: field(CloseRuleSchema).optional(),
    revealStrategy: field(RevealStrategySchema).optional(),
    clarifications: z.array(z.string()),
  })
  .strict();

export type ProposedDraft = z.infer<typeof ProposedDraftSchema>;

/** Fields the assistant may never guess a default for — see design.md §9. */
export const NON_DEFAULTABLE_FIELDS = [
  'attribution',
  'antiBias',
  'scoring',
  'participants',
] as const satisfies readonly (keyof ProposedDraft)[];

const jsonSchemaField = (valueSchema: Record<string, unknown>) => ({
  type: 'object',
  additionalProperties: false,
  required: ['value', 'source'],
  properties: {
    value: valueSchema,
    source: { type: 'string', enum: ['host', 'llm_default', 'llm_extracted'] },
  },
});

const PERSON_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'displayName'],
  properties: {
    id: { type: 'string' },
    displayName: { type: 'string' },
    partnerId: { type: 'string' },
    noScoreWith: { type: 'array', items: { type: 'string' } },
  },
};

const SCORING_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['categories', 'range', 'uniquePerCategory'],
  properties: {
    categories: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'name'],
        properties: { id: { type: 'string' }, name: { type: 'string' } },
      },
    },
    range: {
      oneOf: [
        {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'min', 'max'],
          properties: { type: { const: 'fixed' }, min: { type: 'number' }, max: { type: 'number' } },
        },
        {
          type: 'object',
          additionalProperties: false,
          required: ['type'],
          properties: { type: { const: 'auto' } },
        },
      ],
    },
    uniquePerCategory: { type: 'boolean' },
  },
};

const CLOSE_RULE_JSON_SCHEMA = {
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      required: ['when'],
      properties: { when: { type: 'string', enum: ['all_sent', 'host_trigger'] } },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['when', 'at'],
      properties: { when: { const: 'scheduled' }, at: { type: 'string' } },
    },
  ],
};

const REVEAL_STRATEGY_JSON_SCHEMA = {
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      required: ['when'],
      properties: { when: { const: 'host_trigger' } },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['when', 'at'],
      properties: { when: { const: 'scheduled' }, at: { type: 'string' } },
    },
  ],
};

/**
 * The tool definition offered to the LLM — its JSON schema is the security
 * boundary (design.md §7.1/§11B.2): `additionalProperties: false` at every
 * level, so the model cannot smuggle extra fields through.
 */
export const PROPOSE_CONTEST_DRAFT_TOOL: LLMToolDefinition = {
  name: 'propose_contest_draft',
  description:
    "Propose a contest draft extracted from the host's message. Include only " +
    'the fields you could determine — omit anything you cannot. List every ' +
    'field you left out, and why, in `clarifications`.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['clarifications'],
    properties: {
      name: jsonSchemaField({ type: 'string' }),
      attribution: jsonSchemaField({ type: 'string', enum: ['per_person', 'per_couple'] }),
      antiBias: jsonSchemaField({ type: 'string', enum: ['none', 'couples', 'arbitrary_pairs'] }),
      scoring: jsonSchemaField(SCORING_JSON_SCHEMA),
      participants: jsonSchemaField({ type: 'array', items: PERSON_JSON_SCHEMA }),
      closeRule: jsonSchemaField(CLOSE_RULE_JSON_SCHEMA),
      revealStrategy: jsonSchemaField(REVEAL_STRATEGY_JSON_SCHEMA),
      clarifications: { type: 'array', items: { type: 'string' } },
    },
  },
};
