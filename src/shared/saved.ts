/**
 * Pure helpers for managing the list of saved languages. A saved language is its
 * seed plus a display name and — when the user has diverged from the pure seed —
 * the style knobs and manual overrides needed to reproduce exactly what they saw.
 * (A bare seed still fully regenerates the default language.) Kept free of any
 * browser API so it is unit-testable in Node.
 */

import type { StyleOptions } from '../core/language.js';
import type { LanguageOverrides } from '../core/overrides.js';

export interface SavedLanguage {
  seed: string;
  name: string;
  savedAt: number;
  /** Style knobs used to generate, if diverged from defaults. */
  style?: StyleOptions;
  /** Manual overrides applied on top of the generated language, if any. */
  overrides?: LanguageOverrides;
}

export const MAX_SAVED = 50;

/** Insert or update an entry (matched by seed), most-recent first, capped. */
export function upsertEntry(list: SavedLanguage[], entry: SavedLanguage): SavedLanguage[] {
  const without = list.filter((e) => e.seed !== entry.seed);
  return [entry, ...without].slice(0, MAX_SAVED);
}

/** Remove an entry by seed. */
export function removeFromList(list: SavedLanguage[], seed: string): SavedLanguage[] {
  return list.filter((e) => e.seed !== seed);
}

/** Validate/normalize an arbitrary parsed value into a SavedLanguage list. */
export function normalizeSavedList(value: unknown): SavedLanguage[] {
  if (!Array.isArray(value)) return [];
  const out: SavedLanguage[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const seed = typeof rec.seed === 'string' ? rec.seed : undefined;
    if (!seed || seen.has(seed)) continue;
    seen.add(seed);
    const item2: SavedLanguage = {
      seed,
      name: typeof rec.name === 'string' ? rec.name : seed,
      savedAt: typeof rec.savedAt === 'number' ? rec.savedAt : 0,
    };
    if (rec.style && typeof rec.style === 'object') item2.style = rec.style as StyleOptions;
    if (rec.overrides && typeof rec.overrides === 'object') item2.overrides = rec.overrides as LanguageOverrides;
    out.push(item2);
  }
  return out.slice(0, MAX_SAVED);
}
