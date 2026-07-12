/**
 * Types describing a generated Magpie language (the output of the Phase 2
 * generator) and its lexicon entries. Everything here is derived deterministically
 * from a seed plus the Phase 1 data slice.
 */

export type SegmentType = 'consonant' | 'vowel';

export interface Phoneme {
  roman: string;
  ipa: string;
  type: SegmentType;
}

export interface LanguageInventory {
  phonemes: Phoneme[];
  consonants: string[];
  vowels: string[];
  inspiredBy: string;
}

export interface Phonotactics {
  onsetMax: number;
  codaMax: number;
  templates: string[];
}

export interface SoundChangeRule {
  id: string;
  description: string;
  from: string;
  to: string;
  env: 'any' | 'initial' | 'final' | 'intervocalic' | 'before_front';
  /** Which evolution generation produced this rule (1-based); undefined for the fixed pool. */
  generation?: number;
  /** Human-readable name of the historical sound law, when one applies (e.g. "High German consonant shift"). */
  law?: string;
}

export interface DerivationStep {
  ruleId: string;
  description: string;
  before: string;
  after: string;
}

export interface CaseDef {
  name: string;
  affix: string;
}

export interface GrammarParams {
  wordOrder: 'SOV' | 'SVO' | 'VSO' | 'VOS' | 'OVS' | 'OSV';
  wordOrderSource: string;
  adjNounOrder: 'adjective-noun' | 'noun-adjective';
  pluralAffix: string;
  pluralAffixType: 'suffix' | 'prefix';
  cases: CaseDef[];
  caseAffixPosition: 'suffix' | 'prefix';
}

export interface GeneratedWord {
  english: string;
  ancestorForm: string;
  ancestorLang: string;
  base: string;
  roman: string;
  ipa: string;
  derivation: DerivationStep[];
  origin: 'traced' | 'coined';
}

export type WordLength = 'short' | 'medium' | 'long';

/** Optional style knobs that bias generation (all deterministic given the seed). */
export interface StyleOptions {
  /** PHOIBLE source inventory name to prefer, or omitted/'' for seed-chosen. */
  branch?: string;
  /** 0 = soft/sonorous, 1 = harsh/fricative-heavy. Default 0.5. */
  harshness?: number;
  /** Word-length tendency. Default 'medium'. */
  wordLength?: WordLength;
  /** 0 = simple (few rules, no clusters), 1 = complex. Default 0.5. */
  complexity?: number;
  /** Number of sound-change generations to evolve through (1..MAX_GENERATIONS). Default 3. */
  generations?: number;
}

/** StyleOptions with all defaults applied. */
export interface Style {
  branch: string;
  harshness: number;
  wordLength: WordLength;
  complexity: number;
  generations: number;
}

export const MIN_GENERATIONS = 1;
/**
 * Upper safety guard, not a conceptual limit: generations scale the sound-change
 * ruleset (~3 rules each) applied to every lexicon word, so this only exists to
 * stop a stray huge value from freezing lexicon derivation. Raise freely.
 */
export const MAX_GENERATIONS = 100;

export function resolveStyle(options?: StyleOptions): Style {
  const clamp01 = (n: number | undefined, d: number) =>
    typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : d;
  const gens =
    typeof options?.generations === 'number' && Number.isFinite(options.generations)
      ? Math.max(MIN_GENERATIONS, Math.min(MAX_GENERATIONS, Math.round(options.generations)))
      : 3;
  return {
    branch: options?.branch ?? '',
    harshness: clamp01(options?.harshness, 0.5),
    wordLength: options?.wordLength ?? 'medium',
    complexity: clamp01(options?.complexity, 0.5),
    generations: gens,
  };
}

export interface LanguageDefinition {
  seed: string;
  name: string;
  style: Style;
  inventory: LanguageInventory;
  phonotactics: Phonotactics;
  grammar: GrammarParams;
  soundChangeRules: SoundChangeRule[];
  lexicon: GeneratedWord[];
}
