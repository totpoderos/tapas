import type { HostAssistantCaseInput } from '../../src/host-assistant/case.js';
import { SINGLE_TOOL_CASES } from './single-tool.js';
import { MULTI_TOOL_CASES } from './multi-tool.js';
import { CLARIFICATION_CASES } from './clarification.js';
import { DESTRUCTIVE_CASES } from './destructive.js';
import { ADVERSARIAL_CASES } from './adversarial.js';

/**
 * The frozen 30-case host-assistant (tool-use) eval set (design.md §10.2):
 * 10 single-tool, 8 multi-tool, 4 clarification, 4 destructive-surfacing,
 * 4 adversarial. Committed source, split by group; the structural invariants
 * (the counts, the split, unique ids, every case noted) are hard-gated in
 * `tests/unit/host-assistant/cases.test.ts`. Ground truth describes what a good
 * assistant should do, not what today's local model manages — where it falls
 * short belongs in the thresholds and trajectory (Slice H6c), not a weakened
 * expectation.
 */
export const HOST_ASSISTANT_CASES: HostAssistantCaseInput[] = [
  ...SINGLE_TOOL_CASES,
  ...MULTI_TOOL_CASES,
  ...CLARIFICATION_CASES,
  ...DESTRUCTIVE_CASES,
  ...ADVERSARIAL_CASES,
];
