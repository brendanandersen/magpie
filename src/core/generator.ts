/**
 * Language generator: the Phase 2 orchestrator. Given a seed and the Phase 1 data
 * slice, deterministically produces a complete LanguageDefinition (inventory,
 * phonotactics, grammar, sound-change rules, and a generated core lexicon).
 */

import { Rng } from './rng.js';
import { resolveStyle, type LanguageDefinition, type GeneratedWord, type StyleOptions } from './language.js';
import type { AncestorIndex, PhonemeInventory, ReflexIndex, TypologyIndex } from './data-model.js';
import {
  augmentInventoryWithRuleOutputs,
  buildInventory,
  buildPhonotactics,
  buildWord,
} from './phonology.js';
import { buildGrammar } from './grammar.js';
import { buildEvolvedSoundChanges } from './sound-change.js';
import { coinWord, deriveWord } from './lexicon.js';

export interface GeneratorData {
  inventories: PhonemeInventory[];
  typology: TypologyIndex;
  ancestorIndex: AncestorIndex;
  coreWords: string[];
  /** Modern target-language reflexes per source language (optional data slice). */
  reflexes?: ReflexIndex;
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Generate a language deterministically from a seed (and optional style knobs). */
export function generateLanguage(
  seed: string,
  data: GeneratorData,
  options?: StyleOptions,
): LanguageDefinition {
  const style = resolveStyle(options);
  const rng = new Rng(seed);

  const source =
    (style.branch && data.inventories.find((i) => i.name === style.branch)) || rng.pick(data.inventories);
  const baseInventory = buildInventory(rng, source, style);
  const phonotactics = buildPhonotactics(style);
  const soundChangeRules = buildEvolvedSoundChanges(seed, style);
  const inventory = augmentInventoryWithRuleOutputs(baseInventory, soundChangeRules);
  const grammar = buildGrammar(rng, data.typology, inventory);

  // Endonym: an independent seeded word with simplified phonotactics (single-
  // consonant onsets, light coda) so names stay readable regardless of the
  // language's actual cluster tolerance.
  const nameRng = new Rng(`${seed}::name`);
  const namePhonotactics = { onsetMax: 1, codaMax: Math.min(1, phonotactics.codaMax), templates: phonotactics.templates };
  const name = capitalize(buildWord(nameRng, inventory, namePhonotactics, nameRng.int(2, 3)));

  const lexicon: GeneratedWord[] = data.coreWords.map((english) => {
    const entry = data.ancestorIndex[english];
    return entry
      ? deriveWord(english, entry.best, soundChangeRules, inventory)
      : coinWord(seed, english, inventory, phonotactics, style.wordLength);
  });

  return { seed, name, style, inventory, phonotactics, grammar, soundChangeRules, lexicon };
}
