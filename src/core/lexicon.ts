/**
 * Lexicon generation: turns an English headword plus its ancestor root into a
 * generated conlang word by applying the language's sound-change rules and forcing
 * the result into the inventory. Words with no ancestor are coined deterministically.
 */

import { Rng } from './rng.js';
import type {
  GeneratedWord,
  LanguageInventory,
  Phonotactics,
  SoundChangeRule,
  WordLength,
} from './language.js';
import type { AncestorCandidate } from './data-model.js';
import { normalizeAncestor, applyRules } from './sound-change.js';
import { buildWord, mapToInventory } from './phonology.js';
import { toIpa } from './alphabet.js';

/** Derive a conlang word from a traced ancestor root. */
export function deriveWord(
  english: string,
  ancestor: AncestorCandidate,
  rules: SoundChangeRule[],
  inv: LanguageInventory,
): GeneratedWord {
  const base = normalizeAncestor(ancestor.form);
  const { result, derivation } = applyRules(base, rules);
  const roman = mapToInventory(result, inv);
  return {
    english,
    ancestorForm: ancestor.form,
    ancestorLang: ancestor.lang,
    base,
    roman,
    ipa: toIpa(roman),
    derivation,
    origin: 'traced',
  };
}

const SYLLABLE_RANGE: Record<WordLength, [number, number]> = {
  short: [1, 2],
  medium: [1, 3],
  long: [2, 4],
};

/** Coin a new word for an English headword with no ancestor (deterministic per seed+word). */
export function coinWord(
  seed: string,
  english: string,
  inv: LanguageInventory,
  phon: Phonotactics,
  wordLength: WordLength = 'medium',
): GeneratedWord {
  const rng = new Rng(`${seed}::coin::${english}`);
  const [lo, hi] = SYLLABLE_RANGE[wordLength];
  const syllables = rng.int(lo, hi);
  const roman = buildWord(rng, inv, phon, syllables);
  return {
    english,
    ancestorForm: '',
    ancestorLang: '',
    base: '',
    roman,
    ipa: toIpa(roman),
    derivation: [],
    origin: 'coined',
  };
}
