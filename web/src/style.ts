import type { StyleOptions } from '../../src/shared/types';

/**
 * Branch selection is "owned" by the language-match section: loading a match sets the
 * `branch`, which in turn enables that branch's anchored sound laws (e.g. German). Any
 * OTHER way of picking a seed — typing one or randomizing — must NOT inherit a previously
 * matched branch, or the new seed would silently keep the old branch's anchors.
 *
 * This returns a copy of the style with the branch cleared while preserving the other
 * stylistic knobs (harshness, complexity, word length, generations).
 */
export function seedChosenStyle(style: StyleOptions): StyleOptions {
  const next = { ...style };
  delete next.branch;
  return next;
}
