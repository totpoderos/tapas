import { z } from 'zod';

/**
 * The host-assistant eval measures *tool use*, not text (design.md §10.2). A
 * case is a single host message and what the assistant should propose: which
 * tool(s), in what order, with what arguments — or, for a deliberately vague
 * request, no tool at all (a clarification). The assistant only proposes; it
 * does not execute, so "confirmation surfacing" is checked as *not self-
 * confirming* a destructive call, not as a round-trip.
 */
export const HA_GROUPS = [
  'single_tool',
  'multi_tool',
  'clarification',
  'destructive',
  'adversarial',
] as const;
export type HostAssistantGroup = (typeof HA_GROUPS)[number];

/**
 * The tools the assistant may propose — the MCP host catalog. Kept as a local
 * list (not derived from @tapas/mcp) so that a catalog change is a deliberate,
 * visible change to the eval set too, exactly as the creation eval does.
 */
export const HA_TOOL_NAMES = [
  'get_contest',
  'get_draft',
  'get_tally',
  'get_results',
  'create_draft',
  'update_draft',
  'close_contest',
  'publish_contest',
  'trigger_reveal',
] as const;
export type HaToolName = (typeof HA_TOOL_NAMES)[number];

const ExpectedCallSchema = z
  .object({
    name: z.enum(HA_TOOL_NAMES),
    /** If given, the proposed call's arguments must deep-equal these; if omitted, only the tool name is checked. */
    arguments: z.record(z.unknown()).optional(),
  })
  .strict();

export const HAExpectationSchema = z
  .object({
    /** The tool calls the assistant should propose, in order. Empty means it should clarify — propose no tool. */
    tools: z.array(ExpectedCallSchema).default([]),
    /** Tool names that must NOT be proposed — the sole input to false-tool rate (adversarial / wrong-tool). */
    forbidden: z.array(z.enum(HA_TOOL_NAMES)).default([]),
    /** Destructive: the proposed call must NOT carry a confirmationToken — the assistant must let the gate surface it. */
    mustNotSelfConfirm: z.boolean().default(false),
  })
  .strict();

export type HAExpectation = z.infer<typeof HAExpectationSchema>;

export const HostAssistantCaseSchema = z
  .object({
    id: z.string().min(1),
    group: z.enum(HA_GROUPS),
    /** Why this case exists — read by whoever inspects a regression later. */
    note: z.string().optional(),
    message: z.string().min(1),
    expect: HAExpectationSchema,
  })
  .strict();

export type HostAssistantCase = z.infer<typeof HostAssistantCaseSchema>;

/** Authoring shape: the defaulted expectation fields (`forbidden`, `mustNotSelfConfirm`, empty `tools`) may be omitted. */
export type HostAssistantCaseInput = z.input<typeof HostAssistantCaseSchema>;

/** Validates a case set at load time, so a malformed case fails loudly rather than skewing a metric. */
export function parseHostAssistantCases(cases: readonly unknown[]): HostAssistantCase[] {
  return cases.map((raw, index) => {
    const parsed = HostAssistantCaseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Host-assistant case at index ${index} is invalid: ${parsed.error.message}`);
    }
    return parsed.data;
  });
}
