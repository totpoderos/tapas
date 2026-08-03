import type { DraftContent } from './draft-content.js';

/**
 * One thing a draft has not said yet. A draft is a work in progress, so all
 * three are absent to begin with; publishing is where all three must be present.
 */
export type DraftGap = 'format' | 'participants' | 'scoring';

/**
 * The order they are said in, which is the order a host builds a contest: what
 * kind of thing it is, who is in it, how it is judged.
 */
const GAPS: readonly (readonly [DraftGap, (content: DraftContent) => boolean])[] = [
  ['format', (content) => !content.format],
  ['participants', (content) => !content.participants],
  ['scoring', (content) => !content.scoring],
];

/**
 * What a draft still has to say before it can be published — empty once there is
 * nothing left.
 *
 * This is publishing's own judgement, asked without trying to publish. It was
 * written inside publishing and reachable only by being turned away, which is
 * why a host who built a whole contest by chat learned it was one answer short
 * at the last possible moment, with no sign of it beforehand.
 *
 * It answers with the things themselves rather than a sentence about them: the
 * two front ends write their own words, in two languages, and publishing writes
 * its refusal from the same list. One judgement, worded where it is read.
 */
export function stillNeeded(content: DraftContent): readonly DraftGap[] {
  return GAPS.filter(([, absent]) => absent(content)).map(([gap]) => gap);
}
