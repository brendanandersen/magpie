/**
 * Translation engine: turns an English sentence into a generated Magpie language.
 * Each word is resolved through the hybrid tiers (traced via the ancestor index,
 * else coined), light English morphology is detected (plural), the language's
 * plural affix is applied, and a per-word gloss (origin + derivation) is produced.
 *
 * Word-order transformation is intentionally NOT applied: robust reordering needs
 * syntactic parsing we don't have, and mis-reordering looks worse than faithful
 * word-by-word output. The language's word order is surfaced as metadata instead.
 */

import type { AncestorIndex } from './data-model.js';
import type { GeneratedWord, LanguageDefinition } from './language.js';
import { deriveWord, coinWord } from './lexicon.js';
import { toIpa } from './alphabet.js';

export interface TranslatedToken {
  surface: string;
  isWord: boolean;
  lemma?: string;
  roman?: string;
  ipa?: string;
  origin?: 'traced' | 'coined';
  ancestorForm?: string;
  ancestorLang?: string;
  derivation?: GeneratedWord['derivation'];
  notes: string[];
}

export interface TranslationResult {
  input: string;
  output: string;
  outputIpa: string;
  tokens: TranslatedToken[];
  wordOrder: string;
}

interface Lemma {
  lemma: string;
  plural: boolean;
  reducedFrom?: string;
}

/** Split a sentence into ordered word and separator tokens (roundtrip-preserving). */
export function tokenize(sentence: string): { text: string; isWord: boolean }[] {
  const out: { text: string; isWord: boolean }[] = [];
  const re = /([a-zA-Z']+)|([^a-zA-Z']+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sentence)) !== null) {
    if (m[1] !== undefined) out.push({ text: m[1], isWord: true });
    else out.push({ text: m[2], isWord: false });
  }
  return out;
}

/**
 * Reduce an English surface word to a headword present in the ancestor index,
 * detecting plural number. Tries the word as-is, then plural and common
 * inflectional reductions; returns the first candidate found in the index.
 */
export function lemmatize(surface: string, index: AncestorIndex): Lemma {
  const lower = surface.toLowerCase();
  if (index[lower]) return { lemma: lower, plural: false };

  const pluralCandidates: string[] = [];
  if (lower.endsWith('ies') && lower.length > 3) pluralCandidates.push(lower.slice(0, -3) + 'y');
  if (lower.endsWith('es') && lower.length > 2) pluralCandidates.push(lower.slice(0, -2));
  if (lower.endsWith('s') && lower.length > 1) pluralCandidates.push(lower.slice(0, -1));
  for (const cand of pluralCandidates) {
    if (index[cand]) return { lemma: cand, plural: true, reducedFrom: lower };
  }

  const otherCandidates: string[] = [];
  if (lower.endsWith('ing') && lower.length > 4) {
    otherCandidates.push(lower.slice(0, -3), lower.slice(0, -3) + 'e');
  }
  if (lower.endsWith('ed') && lower.length > 3) {
    otherCandidates.push(lower.slice(0, -2), lower.slice(0, -1));
  }
  if (lower.endsWith('est') && lower.length > 4) otherCandidates.push(lower.slice(0, -3));
  if (lower.endsWith('er') && lower.length > 3) otherCandidates.push(lower.slice(0, -2));
  if (lower.endsWith('ly') && lower.length > 3) otherCandidates.push(lower.slice(0, -2));
  for (const cand of otherCandidates) {
    if (index[cand]) return { lemma: cand, plural: false, reducedFrom: lower };
  }

  return { lemma: lower, plural: false };
}

/** Resolve a lemma to a conlang word: traced via the index, else coined. */
export function resolveWord(
  lemma: string,
  lang: LanguageDefinition,
  index: AncestorIndex,
): GeneratedWord {
  const entry = index[lemma];
  if (entry) return deriveWord(lemma, entry.best, lang.soundChangeRules, lang.inventory);
  return coinWord(lang.seed, lemma, lang.inventory, lang.phonotactics);
}

/** Apply plural morphology (if detected) to a generated word's surface form. */
function applyMorphology(
  word: GeneratedWord,
  plural: boolean,
  lang: LanguageDefinition,
): { roman: string; notes: string[] } {
  const notes: string[] = [];
  let roman = word.roman;
  if (plural && lang.grammar.pluralAffix) {
    const affix = lang.grammar.pluralAffix;
    roman =
      lang.grammar.pluralAffixType === 'prefix' ? `${affix}${roman}` : `${roman}${affix}`;
    notes.push(`plural (${lang.grammar.pluralAffixType} "${affix}")`);
  }
  return { roman, notes };
}

/** Translate an English sentence into the given generated language. */
export function translate(
  sentence: string,
  lang: LanguageDefinition,
  index: AncestorIndex,
): TranslationResult {
  const rawTokens = tokenize(sentence);
  const tokens: TranslatedToken[] = [];
  let output = '';
  let outputIpa = '';

  for (const t of rawTokens) {
    if (!t.isWord) {
      tokens.push({ surface: t.text, isWord: false, notes: [] });
      output += t.text;
      outputIpa += t.text;
      continue;
    }

    const { lemma, plural, reducedFrom } = lemmatize(t.text, index);
    const word = resolveWord(lemma, lang, index);
    const { roman, notes } = applyMorphology(word, plural, lang);
    const ipa = toIpa(roman);
    if (reducedFrom) notes.push(`reduced from "${reducedFrom}"`);
    if (word.origin === 'traced') notes.push(`${word.ancestorLang}: ${word.ancestorForm}`);
    else notes.push('coined (no attested ancestor)');

    tokens.push({
      surface: t.text,
      isWord: true,
      lemma,
      roman,
      ipa,
      origin: word.origin,
      ancestorForm: word.ancestorForm,
      ancestorLang: word.ancestorLang,
      derivation: word.derivation,
      notes,
    });
    output += roman;
    outputIpa += ipa;
  }

  return { input: sentence, output, outputIpa, tokens, wordOrder: lang.grammar.wordOrder };
}
