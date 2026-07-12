/**
 * Reverse translation (conlang -> English). Generation is deterministic but lossy
 * (sound changes + inventory mapping merge distinct sources), so reverse works by
 * matching conlang words against the language's known vocabulary: exact match,
 * then plural-affix stripping, then nearest match by edit distance. Matches beyond
 * a distance threshold are reported as unknown.
 */

import type { GeneratedWord, LanguageDefinition } from './language.js';
import { tokenize } from './translator.js';

export interface ReverseToken {
  surface: string;
  isWord: boolean;
  english?: string;
  approx?: boolean;
  plural?: boolean;
  notes: string[];
}

export interface ReverseResult {
  input: string;
  output: string;
  tokens: ReverseToken[];
}

/** Levenshtein edit distance. */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** roman conlang form -> English headword (first occurrence wins). */
export function buildReverseIndex(vocab: GeneratedWord[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const w of vocab) {
    if (w.roman && !index.has(w.roman)) index.set(w.roman, w.english);
  }
  return index;
}

function stripPlural(word: string, lang: LanguageDefinition): string | null {
  const { pluralAffix, pluralAffixType } = lang.grammar;
  if (!pluralAffix) return null;
  if (pluralAffixType === 'suffix' && word.endsWith(pluralAffix) && word.length > pluralAffix.length) {
    return word.slice(0, -pluralAffix.length);
  }
  if (pluralAffixType === 'prefix' && word.startsWith(pluralAffix) && word.length > pluralAffix.length) {
    return word.slice(pluralAffix.length);
  }
  return null;
}

function nearest(word: string, index: Map<string, string>): { english: string; dist: number } | null {
  let best: { english: string; dist: number } | null = null;
  for (const [roman, english] of index) {
    const d = levenshtein(word, roman);
    if (!best || d < best.dist) best = { english, dist: d };
  }
  return best;
}

/** Translate a conlang sentence back to (approximate) English. */
export function reverseTranslate(
  sentence: string,
  lang: LanguageDefinition,
  vocab: GeneratedWord[] = lang.lexicon,
): ReverseResult {
  const index = buildReverseIndex(vocab);
  const tokens: ReverseToken[] = [];
  let output = '';

  for (const t of tokenize(sentence)) {
    if (!t.isWord) {
      tokens.push({ surface: t.text, isWord: false, notes: [] });
      output += t.text;
      continue;
    }

    const lower = t.text.toLowerCase();
    const notes: string[] = [];
    let english: string | undefined;
    let approx = false;
    let plural = false;

    if (index.has(lower)) {
      english = index.get(lower);
    } else {
      const base = stripPlural(lower, lang);
      if (base && index.has(base)) {
        english = index.get(base);
        plural = true;
        notes.push('plural');
      } else {
        const near = nearest(lower, index);
        const threshold = Math.max(1, Math.floor(lower.length * 0.34));
        if (near && near.dist <= threshold) {
          english = near.english;
          approx = true;
          notes.push(`approximate match (distance ${near.dist})`);
        }
      }
    }

    if (!english) {
      english = `⟨${t.text}⟩`;
      notes.push('unknown word');
    }

    const word = plural ? `${english}s` : english;
    tokens.push({ surface: t.text, isWord: true, english: word, approx, plural, notes });
    output += word;
  }

  return { input: sentence, output, tokens };
}
