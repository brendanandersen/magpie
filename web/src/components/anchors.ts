import type { SoundChangeRule } from '../../../src/shared/types';

/**
 * Presentation helpers for surfacing branch-anchored sound laws in the editor.
 *
 * Branch anchors are the always-on, defining historical laws applied to every seed on a
 * real branch (see `BRANCH_ANCHORS` in `src/core/sound-change.ts`). They are identified by
 * a stable id prefix (`anchor_<branch>_<phase>_...`) and a bracketed description label
 * (`[German] t → ss / between vowels`). These helpers stay framework-free so they can be
 * unit-tested without a DOM.
 */

export type AnchorPhase = 'early' | 'late';

export interface AnchorInfo {
  /** Human-readable branch label parsed from the description (e.g. "German"). */
  branch: string;
  /** `early` = proto-stage laws (run first); `late` = younger defining shifts (run last). */
  phase: AnchorPhase;
}

/** True when a rule is a branch anchor (vs a per-seed generative or custom rule). */
export function isAnchorRule(rule: SoundChangeRule): boolean {
  return rule.id.startsWith('anchor_');
}

/**
 * Parse the branch + phase of an anchor rule, or null if it is not an anchor.
 * The stable id (`anchor_<branch>_<phase>_...`) is the source of truth so the info
 * survives edits that rewrite the human-readable description; the bracketed description
 * label (`[German] …`) is preferred when present for a prettier branch name.
 */
export function anchorInfo(rule: SoundChangeRule): AnchorInfo | null {
  if (!isAnchorRule(rule)) return null;
  const parts = rule.id.split('_'); // ['anchor', <branch>, <phase>, …]
  const phase: AnchorPhase = parts[2] === 'late' ? 'late' : 'early';
  const branch = /^\[([^\]]+)\]/.exec(rule.description)?.[1] ?? parts[1] ?? 'anchored';
  return { branch, phase };
}

/**
 * A group of rules is "anchored" iff it is non-empty and every rule in it is an anchor.
 * Returns the shared anchor info (from the first rule) or null for a normal generation.
 */
export function groupAnchorInfo(rules: SoundChangeRule[]): AnchorInfo | null {
  if (rules.length === 0 || !rules.every(isAnchorRule)) return null;
  return anchorInfo(rules[0]);
}

/** Short caption for an anchor group's phase. */
export function anchorPhaseLabel(phase: AnchorPhase): string {
  return phase === 'early' ? 'proto-stage laws' : 'defining shift';
}
