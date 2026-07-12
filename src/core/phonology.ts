/**
 * Phonology generation: builds a language's phoneme inventory (grounded in a
 * PHOIBLE source inventory), its phonotactics, a word builder for coined words and
 * names, and a mapper that forces arbitrary segment strings into the inventory.
 */

import { Rng } from './rng.js';
import type { LanguageInventory, Phoneme, Phonotactics, SoundChangeRule, Style } from './language.js';
import type { PhonemeInventory } from './data-model.js';
import {
  GUARANTEED_CONSONANTS,
  GUARANTEED_VOWELS,
  OPTIONAL_CONSONANTS,
  OPTIONAL_VOWELS,
  IPA_MAP,
  isVowelSegment,
  tokenize,
} from './alphabet.js';

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function toPhonemes(consonants: string[], vowels: string[]): Phoneme[] {
  const cons: Phoneme[] = consonants.map((c) => ({ roman: c, ipa: IPA_MAP[c] ?? c, type: 'consonant' }));
  const vow: Phoneme[] = vowels.map((v) => ({ roman: v, ipa: IPA_MAP[v] ?? v, type: 'vowel' }));
  return [...cons, ...vow];
}

/** Build an inventory from explicit consonant/vowel lists (used for manual edits). */
export function makeInventory(
  consonants: string[],
  vowels: string[],
  inspiredBy: string,
): LanguageInventory {
  return { consonants, vowels, phonemes: toPhonemes(consonants, vowels), inspiredBy };
}

/** How "harsh" (fricative/strident) each optional consonant sounds, 0 (soft) .. 1 (harsh). */
const HARSHNESS: Record<string, number> = {
  p: 0.5, b: 0.3, d: 0.3, g: 0.3, f: 0.7, v: 0.4, z: 0.7, h: 0.4, w: 0.1, j: 0.1,
  th: 0.8, kh: 0.9, gh: 0.8, sh: 0.8, dh: 0.7,
};

const HARSH_SET = ['th', 'kh', 'gh', 'sh', 'dh'];
const SOFT_SET = ['w', 'j', 'v', 'h'];

/** Pick n distinct items from a pool weighted by a function, without replacement. */
function weightedSample(rng: Rng, pool: string[], n: number, weight: (s: string) => number): string[] {
  const remaining = [...pool];
  const chosen: string[] = [];
  while (chosen.length < n && remaining.length > 0) {
    const pick = rng.weightedPick(remaining, weight);
    chosen.push(pick);
    remaining.splice(remaining.indexOf(pick), 1);
  }
  return chosen;
}

/**
 * Build the inventory. Sample size is biased by the PHOIBLE source richness and by
 * `style.complexity`; consonant choice is biased by `style.harshness` (harsh sounds
 * favored when high, sonorants when low). Small safeguards guarantee the harshness
 * setting is audible at the extremes.
 */
export function buildInventory(rng: Rng, source: PhonemeInventory, style: Style): LanguageInventory {
  const consBase = clamp(Math.round(source.consonants.length / 6), 2, OPTIONAL_CONSONANTS.length);
  const consExtra = clamp(consBase + Math.round((style.complexity - 0.5) * 6), 2, OPTIONAL_CONSONANTS.length);
  const vowBase = clamp(Math.round(source.vowels.length / 8), 0, OPTIONAL_VOWELS.length);
  const vowExtra = clamp(vowBase + (style.complexity >= 0.66 ? 1 : 0), 0, OPTIONAL_VOWELS.length);

  const h = style.harshness;
  const weight = (c: string) => {
    const hv = HARSHNESS[c] ?? 0.5;
    return hv * h + (1 - hv) * (1 - h) + 0.05;
  };
  const optional = weightedSample(rng, OPTIONAL_CONSONANTS, consExtra, weight);

  // Guarantee the extreme is audible.
  if (h >= 0.8 && !optional.some((c) => HARSH_SET.includes(c))) optional.push('kh');
  if (h <= 0.2 && !optional.some((c) => SOFT_SET.includes(c))) optional.push('w');

  const consonants = [...GUARANTEED_CONSONANTS, ...optional];
  const vowels = [...GUARANTEED_VOWELS, ...rng.sample(OPTIONAL_VOWELS, vowExtra)];

  return {
    phonemes: toPhonemes(consonants, vowels),
    consonants,
    vowels,
    inspiredBy: source.name,
  };
}

/**
 * Ensure sounds produced by the sound-change rules exist in the inventory, so a
 * rule like "p → f" actually surfaces its output instead of being remapped away.
 * Does not consume the RNG (order-independent, preserves determinism).
 */
export function augmentInventoryWithRuleOutputs(
  inv: LanguageInventory,
  rules: SoundChangeRule[],
): LanguageInventory {
  const consonants = [...inv.consonants];
  const vowels = [...inv.vowels];
  const consSet = new Set(consonants);
  const vowSet = new Set(vowels);

  for (const rule of rules) {
    for (const seg of tokenize(rule.to)) {
      if (isVowelSegment(seg)) {
        if (!vowSet.has(seg)) {
          vowSet.add(seg);
          vowels.push(seg);
        }
      } else if (!consSet.has(seg)) {
        consSet.add(seg);
        consonants.push(seg);
      }
    }
  }

  return { ...inv, consonants, vowels, phonemes: toPhonemes(consonants, vowels) };
}

export function buildPhonotactics(style: Style): Phonotactics {
  const onsetMax = style.complexity >= 0.6 ? 2 : 1;
  const codaMax = style.complexity < 0.3 ? 0 : style.complexity >= 0.75 ? 2 : 1;
  const templates = ['CV', 'CVC'];
  if (onsetMax > 1) templates.push('CCV');
  if (codaMax > 0) templates.push('VC');
  return { onsetMax, codaMax, templates };
}

/** Build a single syllable's romanization from the inventory. */
function buildSyllable(rng: Rng, inv: LanguageInventory, phon: Phonotactics): string {
  const onsetCount = rng.int(1, phon.onsetMax);
  const codaCount = rng.int(0, phon.codaMax);
  let s = '';
  for (let i = 0; i < onsetCount; i++) s += rng.pick(inv.consonants);
  s += rng.pick(inv.vowels);
  for (let i = 0; i < codaCount; i++) s += rng.pick(inv.consonants);
  return s;
}

/** Build a romanized word of `syllables` syllables from the inventory. */
export function buildWord(
  rng: Rng,
  inv: LanguageInventory,
  phon: Phonotactics,
  syllables: number,
): string {
  let w = '';
  for (let i = 0; i < syllables; i++) w += buildSyllable(rng, inv, phon);
  return w;
}

/** Deterministic fallback index for a segment not present in the inventory. */
function fallbackIndex(seg: string, size: number): number {
  let h = 0;
  for (let i = 0; i < seg.length; i++) h = (h * 31 + seg.charCodeAt(i)) >>> 0;
  return h % size;
}

/**
 * Force an arbitrary romanized string into the language's inventory: any segment
 * not in the inventory is deterministically replaced by an in-inventory segment of
 * the same class. Guarantees a non-empty result.
 */
export function mapToInventory(word: string, inv: LanguageInventory): string {
  const consSet = new Set(inv.consonants);
  const vowSet = new Set(inv.vowels);
  const out = tokenize(word).map((seg) => {
    if (isVowelSegment(seg)) {
      return vowSet.has(seg) ? seg : inv.vowels[fallbackIndex(seg, inv.vowels.length)];
    }
    return consSet.has(seg) ? seg : inv.consonants[fallbackIndex(seg, inv.consonants.length)];
  });
  let result = out.join('');
  if (result.length === 0) {
    result = `${inv.consonants[0]}${inv.vowels[0]}`;
  }
  return result;
}
