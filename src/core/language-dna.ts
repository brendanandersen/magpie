/**
 * "Language DNA": compares a generated language's typological profile (word order,
 * adjective order, case system, plural strategy) against a curated set of real
 * languages and ranks the nearest matches. Self-contained (only a type import) so
 * it is safe to run in the browser without bundling generator internals.
 */

import type { GrammarParams } from './language.js';

export interface ReferenceLanguage {
  name: string;
  wordOrder: string;
  adjNounOrder: 'adjective-noun' | 'noun-adjective';
  caseCount: number;
  pluralAffixType: 'suffix' | 'prefix' | 'none';
  caseAffixPosition: 'suffix' | 'prefix' | 'none';
}

export interface DnaMatch {
  name: string;
  similarity: number;
  shared: string[];
}

export interface DnaVector {
  wordOrder: string;
  adjNounOrder: 'adjective-noun' | 'noun-adjective';
  caseCount: number;
  pluralAffixType: 'suffix' | 'prefix' | 'none';
  caseAffixPosition: 'suffix' | 'prefix' | 'none';
}

/** Approximate WALS-style profiles for well-known languages (recognizable, not exhaustive). */
export const REFERENCE_LANGUAGES: ReferenceLanguage[] = [
  { name: 'English', wordOrder: 'SVO', adjNounOrder: 'adjective-noun', caseCount: 0, pluralAffixType: 'suffix', caseAffixPosition: 'none' },
  { name: 'German', wordOrder: 'SVO', adjNounOrder: 'adjective-noun', caseCount: 4, pluralAffixType: 'suffix', caseAffixPosition: 'suffix' },
  { name: 'Latin', wordOrder: 'SOV', adjNounOrder: 'adjective-noun', caseCount: 6, pluralAffixType: 'suffix', caseAffixPosition: 'suffix' },
  { name: 'French', wordOrder: 'SVO', adjNounOrder: 'noun-adjective', caseCount: 0, pluralAffixType: 'suffix', caseAffixPosition: 'none' },
  { name: 'Spanish', wordOrder: 'SVO', adjNounOrder: 'noun-adjective', caseCount: 0, pluralAffixType: 'suffix', caseAffixPosition: 'none' },
  { name: 'Russian', wordOrder: 'SVO', adjNounOrder: 'adjective-noun', caseCount: 6, pluralAffixType: 'suffix', caseAffixPosition: 'suffix' },
  { name: 'Ancient Greek', wordOrder: 'SOV', adjNounOrder: 'adjective-noun', caseCount: 5, pluralAffixType: 'suffix', caseAffixPosition: 'suffix' },
  { name: 'Hindi', wordOrder: 'SOV', adjNounOrder: 'adjective-noun', caseCount: 3, pluralAffixType: 'suffix', caseAffixPosition: 'suffix' },
  { name: 'Japanese', wordOrder: 'SOV', adjNounOrder: 'adjective-noun', caseCount: 8, pluralAffixType: 'none', caseAffixPosition: 'suffix' },
  { name: 'Turkish', wordOrder: 'SOV', adjNounOrder: 'adjective-noun', caseCount: 6, pluralAffixType: 'suffix', caseAffixPosition: 'suffix' },
  { name: 'Arabic', wordOrder: 'VSO', adjNounOrder: 'noun-adjective', caseCount: 3, pluralAffixType: 'suffix', caseAffixPosition: 'suffix' },
  { name: 'Welsh', wordOrder: 'VSO', adjNounOrder: 'noun-adjective', caseCount: 0, pluralAffixType: 'suffix', caseAffixPosition: 'none' },
  { name: 'Mandarin', wordOrder: 'SVO', adjNounOrder: 'adjective-noun', caseCount: 0, pluralAffixType: 'none', caseAffixPosition: 'none' },
  { name: 'Finnish', wordOrder: 'SVO', adjNounOrder: 'adjective-noun', caseCount: 10, pluralAffixType: 'suffix', caseAffixPosition: 'suffix' },
];

const WEIGHTS = { wordOrder: 0.3, adjNounOrder: 0.2, caseCount: 0.2, pluralAffixType: 0.15, caseAffixPosition: 0.15 };
const CASE_SCALE = 5;

/** Reduce a generated grammar to a comparable typological vector. */
export function grammarToVector(g: GrammarParams): DnaVector {
  const caseCount = g.cases.length;
  return {
    wordOrder: g.wordOrder,
    adjNounOrder: g.adjNounOrder,
    caseCount,
    pluralAffixType: g.pluralAffixType,
    caseAffixPosition: caseCount > 0 ? g.caseAffixPosition : 'none',
  };
}

/** Rank the reference languages by typological similarity to the given grammar. */
export function compareLanguageDNA(
  g: GrammarParams,
  refs: ReferenceLanguage[] = REFERENCE_LANGUAGES,
): DnaMatch[] {
  const v = grammarToVector(g);
  return refs
    .map((ref) => {
      const shared: string[] = [];
      let score = 0;

      if (v.wordOrder === ref.wordOrder) {
        score += WEIGHTS.wordOrder;
        shared.push(`word order (${ref.wordOrder})`);
      }
      if (v.adjNounOrder === ref.adjNounOrder) {
        score += WEIGHTS.adjNounOrder;
        shared.push(v.adjNounOrder);
      }
      const caseScore = 1 - Math.min(Math.abs(v.caseCount - ref.caseCount), CASE_SCALE) / CASE_SCALE;
      score += WEIGHTS.caseCount * caseScore;
      if (Math.abs(v.caseCount - ref.caseCount) <= 1) shared.push('case count');
      if (v.pluralAffixType === ref.pluralAffixType) {
        score += WEIGHTS.pluralAffixType;
        shared.push('plural strategy');
      }
      if (v.caseAffixPosition === ref.caseAffixPosition) {
        score += WEIGHTS.caseAffixPosition;
        shared.push('case marking');
      }

      return { name: ref.name, similarity: Math.round(score * 100) / 100, shared };
    })
    .sort((a, b) => b.similarity - a.similarity || a.name.localeCompare(b.name));
}
