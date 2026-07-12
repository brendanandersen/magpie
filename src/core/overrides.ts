/**
 * Manual overrides: apply a user-authored sound-change rule set and/or edited
 * phoneme inventory to an already-generated language, re-deriving its lexicon so
 * edits are immediately reflected. Pure and deterministic; safe to run in the
 * browser (no data-slice dependency) and on the server (before translating).
 */

import type { GeneratedWord, LanguageDefinition, SoundChangeRule } from './language.js';
import type { AncestorCandidate } from './data-model.js';
import { deriveWord, coinWord } from './lexicon.js';
import { makeInventory } from './phonology.js';

export interface LanguageOverrides {
  soundChangeRules?: SoundChangeRule[];
  consonants?: string[];
  vowels?: string[];
}

export function hasOverrides(o?: LanguageOverrides): boolean {
  return !!o && (o.soundChangeRules !== undefined || o.consonants !== undefined || o.vowels !== undefined);
}

/** Re-derive every lexicon entry using the given rules/inventory. */
export function rederiveLexicon(
  lang: LanguageDefinition,
  rules: SoundChangeRule[],
  inventoryConsonants: string[],
  inventoryVowels: string[],
): GeneratedWord[] {
  const inventory = makeInventory(inventoryConsonants, inventoryVowels, lang.inventory.inspiredBy);
  return lang.lexicon.map((w) => {
    if (w.origin === 'traced' && w.ancestorForm) {
      const candidate: AncestorCandidate = {
        form: w.ancestorForm,
        lang: w.ancestorLang,
        relationshipType: '',
        confidence: 0,
        depth: 0,
        hops: 1,
        score: 0,
      };
      return deriveWord(w.english, candidate, rules, inventory);
    }
    return coinWord(lang.seed, w.english, inventory, lang.phonotactics, lang.style.wordLength);
  });
}

/**
 * Return a new LanguageDefinition with the given overrides applied and the lexicon
 * re-derived. Fields not overridden are kept from the base language.
 */
export function applyOverrides(lang: LanguageDefinition, overrides: LanguageOverrides): LanguageDefinition {
  const soundChangeRules = overrides.soundChangeRules ?? lang.soundChangeRules;
  const consonants = overrides.consonants ?? lang.inventory.consonants;
  const vowels = overrides.vowels ?? lang.inventory.vowels;
  const inventory = makeInventory(consonants, vowels, lang.inventory.inspiredBy);
  const lexicon = rederiveLexicon(lang, soundChangeRules, consonants, vowels);
  return { ...lang, soundChangeRules, inventory, lexicon };
}
