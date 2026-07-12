/**
 * Language approximation: search for a seed (and style) whose deterministically
 * generated language is phonetically and typologically close to a real target
 * language. Because the generator's inventory is fully reproducible from a
 * seed + style (no lexicon needed), the search builds lightweight "profiles" and
 * ranks them against a target's phoneme inventory, grammar DNA, and phonotactics.
 *
 * Phoneme comparison normalizes both sides to a coarse "base" phoneme (stripping
 * length marks, diacritics, and affricate tails) so the generator's small ASCII-
 * derived IPA set is comparable to the richly annotated source inventories.
 *
 * The primary signal, when available, is LEXICAL FIDELITY: each seed's rules evolve
 * the deep (PIE) root of core concepts, and we measure how close the output lands to
 * the real modern target word (e.g. water -> "Wasser"). This rewards seeds whose
 * random sound laws approximate the language's actual historical trajectory, without
 * ever short-circuiting to the modern root.
 */

import { Rng } from './rng.js';
import {
  resolveStyle,
  type StyleOptions,
  type GrammarParams,
  type Phonotactics,
  type LanguageInventory,
  type SoundChangeRule,
} from './language.js';
import type { AncestorIndex, PhonemeInventory, ReflexIndex, TypologyIndex } from './data-model.js';
import { buildInventory, buildPhonotactics, augmentInventoryWithRuleOutputs, mapToInventory } from './phonology.js';
import { buildEvolvedSoundChanges, normalizeAncestor, applyRules } from './sound-change.js';
import { buildGrammar } from './grammar.js';
import { compareLanguageDNA } from './language-dna.js';
import { levenshtein } from './reverse.js';

/** The subset of generator data the search needs. */
export interface MatchData {
  inventories: PhonemeInventory[];
  typology: TypologyIndex;
  /** Deep-root index; required for lexical-fidelity scoring. */
  ancestorIndex?: AncestorIndex;
  /** Modern reflexes per source language; enables lexical-fidelity scoring. */
  reflexes?: ReflexIndex;
}

export interface MatchTarget {
  name: string;
  consonants: string[];
  vowels: string[];
}

/** One PIE-derived vs real-modern-word comparison, for display. */
export interface WordExample {
  concept: string;
  ours: string;
  real: string;
  similarity: number;
}

export interface SeedMatch {
  seed: string;
  style: StyleOptions;
  score: number;
  phonemeScore: number;
  /** null when the target has no reference typology profile. */
  typologyScore: number | null;
  phonotacticsScore: number;
  /** Mean closeness of PIE-derived output to real modern words; null if no reflex data. */
  lexicalScore: number | null;
  /** How many core concepts were scored lexically. */
  lexicalCoverage: number;
  /** Sample PIE-derived vs real-word comparisons (best matches first). */
  examples: WordExample[];
  matched: string[];
  missing: string[];
  extra: string[];
}

export interface FindOptions {
  seedCount?: number;
  topK?: number;
  sweepStyle?: boolean;
}

/** Minimum reflex coverage before lexical fidelity is trusted as the primary signal. */
const MIN_LEXICAL_COVERAGE = 8;

/** Modifier letters (superscripts, length, etc.) stripped when reducing to a base phoneme. */
const MODIFIER_LETTERS = /[ʰʱʲʷˠˤˀˑːʼⁿˢˣˀ˞]/g;

/** Reduce an IPA symbol to a coarse base phoneme (e.g. kʰ->k, d̠ʒ->d, øː->ø, aɪ->a). */
export function basePhoneme(symbol: string): string {
  const stripped = symbol
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(MODIFIER_LETTERS, '');
  const chars = Array.from(stripped);
  return chars.length > 0 ? chars[0] : symbol;
}

/** Build a set of coarse base phonemes from a list of IPA symbols. */
export function baseSet(symbols: string[]): Set<string> {
  const out = new Set<string>();
  for (const s of symbols) {
    const b = basePhoneme(s);
    if (b) out.add(b);
  }
  return out;
}

interface Overlap {
  score: number;
  shared: string[];
  missing: string[];
  extra: string[];
}

/** Jaccard overlap of `generated` against `target`, plus shared/missing/extra members. */
function overlap(generated: Set<string>, target: Set<string>): Overlap {
  const shared: string[] = [];
  const missing: string[] = [];
  for (const x of target) (generated.has(x) ? shared : missing).push(x);
  const extra: string[] = [];
  for (const x of generated) if (!target.has(x)) extra.push(x);
  const union = new Set([...generated, ...target]).size;
  const score = union === 0 ? 1 : shared.length / union;
  return {
    score,
    shared: shared.sort(),
    missing: missing.sort(),
    extra: extra.sort(),
  };
}

/** Coarse target syllable structure (real-language cluster tolerance), by name. */
const TARGET_PHONOTACTICS: Record<string, Pick<Phonotactics, 'onsetMax' | 'codaMax'>> = {
  German: { onsetMax: 2, codaMax: 2 },
  English: { onsetMax: 3, codaMax: 3 }, // English tolerates heavy clusters (str-, -ngths)
  French: { onsetMax: 2, codaMax: 1 },
  Russian: { onsetMax: 2, codaMax: 2 },
  Greek: { onsetMax: 2, codaMax: 1 },
  Icelandic: { onsetMax: 2, codaMax: 2 },
  Sanskrit: { onsetMax: 2, codaMax: 1 },
};
const DEFAULT_TARGET_PHONOTACTICS = { onsetMax: 1, codaMax: 1 };

/** Target names that have a typology profile in language-dna's REFERENCE_LANGUAGES. */
const REFERENCE_BY_NAME: Record<string, string> = {
  German: 'German',
  English: 'English',
  French: 'French',
  Russian: 'Russian',
};

function phonotacticsSim(a: Pick<Phonotactics, 'onsetMax' | 'codaMax'>, b: Pick<Phonotactics, 'onsetMax' | 'codaMax'>): number {
  const onset = 1 - Math.min(Math.abs(a.onsetMax - b.onsetMax), 2) / 2;
  const coda = 1 - Math.min(Math.abs(a.codaMax - b.codaMax), 2) / 2;
  return 0.5 * onset + 0.5 * coda;
}

/** A lightweight generation result (no full lexicon) used for scoring. */
export interface GeneratedProfile {
  consonantsIpa: string[];
  vowelsIpa: string[];
  grammar: GrammarParams;
  phonotactics: Phonotactics;
  inventory: LanguageInventory;
  rules: SoundChangeRule[];
}

/**
 * Reproduce a seed+style's inventory, grammar, phonotactics, and sound-change rules
 * without building the full lexicon. RNG consumption order mirrors generateLanguage
 * exactly, so a match found here regenerates the same inventory in the full generator.
 */
export function buildProfile(seed: string, data: MatchData, options?: StyleOptions): GeneratedProfile {
  const style = resolveStyle(options);
  const rng = new Rng(seed);
  const source =
    (style.branch && data.inventories.find((i) => i.name === style.branch)) || rng.pick(data.inventories);
  const base = buildInventory(rng, source, style);
  const phonotactics = buildPhonotactics(style);
  const rules = buildEvolvedSoundChanges(seed, style);
  const inv = augmentInventoryWithRuleOutputs(base, rules);
  const grammar = buildGrammar(rng, data.typology, inv);
  return {
    consonantsIpa: inv.phonemes.filter((p) => p.type === 'consonant').map((p) => p.ipa),
    vowelsIpa: inv.phonemes.filter((p) => p.type === 'vowel').map((p) => p.ipa),
    grammar,
    phonotactics,
    inventory: inv,
    rules,
  };
}

/** Normalized string closeness in [0,1] (1 = identical after ancestor normalization). */
export function formSimilarity(a: string, b: string): number {
  const na = normalizeAncestor(a);
  const nb = normalizeAncestor(b);
  const max = Math.max(na.length, nb.length);
  if (max === 0) return na === nb ? 1 : 0;
  return 1 - levenshtein(na, nb) / max;
}

/**
 * Real intermediate stages between PIE and a modern target, lowercased as they
 * appear in the dataset. A seed's derivation trajectory earns partial credit for
 * passing near these attested waypoint forms.
 */
const BRANCH_WAYPOINT_LANGS: Record<string, string[]> = {
  German: ['old high german', 'proto-west germanic', 'proto-germanic', 'old saxon', 'gothic', 'old dutch'],
  English: ['old english', 'middle english', 'proto-west germanic', 'proto-germanic', 'gothic'],
  Icelandic: ['old norse', 'proto-germanic', 'proto-west germanic', 'gothic'],
  French: ['old french', 'middle french', 'late latin', 'vulgar latin', 'latin', 'proto-italic'],
};

/**
 * Weight of the intermediate-waypoint bonus within a concept's lexical score.
 * Swept 0..0.9 against real German: modern-word fidelity peaks at 0.3 and
 * degrades above it (higher weights select seeds that hit waypoints but land
 * further from the modern reflex), so 0.3 is the sweet spot.
 */
const WAYPOINT_WEIGHT = 0.3;

export function waypointLangsFor(targetName: string): string[] {
  return BRANCH_WAYPOINT_LANGS[targetName] ?? [];
}

/** Context needed for lexical-fidelity scoring. */
export interface LexicalContext {
  ancestorIndex: AncestorIndex;
  reflexes: Record<string, string>;
  /** Lowercased intermediate-stage language names to reward passing through. */
  waypointLangs?: string[];
}

interface LexicalResult {
  score: number;
  coverage: number;
  examples: WordExample[];
}

/** Best closeness of any trajectory state (already lowercase a-z) to a target form. */
function bestTrajectorySimilarity(trajectory: string[], target: string): number {
  let best = 0;
  const max0 = target.length;
  for (const state of trajectory) {
    const max = Math.max(state.length, max0);
    const sim = max === 0 ? 1 : 1 - levenshtein(state, target) / max;
    if (sim > best) best = sim;
  }
  return best;
}

/**
 * Evolve each concept's deep (PIE-preferred) root through the profile's rules and
 * measure closeness to the real modern reflex, plus a bonus for passing near the
 * real intermediate forms (Proto-Germanic/OHG, etc.). Returns null when too few
 * concepts have both a root and a Latin-script reflex.
 */
export function computeLexical(profile: GeneratedProfile, ctx: LexicalContext): LexicalResult | null {
  const concepts = Object.keys(ctx.reflexes).sort();
  const waypointLangs = ctx.waypointLangs ?? [];
  const examples: WordExample[] = [];
  let sum = 0;
  for (const concept of concepts) {
    const entry = ctx.ancestorIndex[concept];
    const real = ctx.reflexes[concept];
    if (!entry || !real) continue;
    // Skip reflexes that carry no Latin-script content (Cyrillic/Devanagari/Greek):
    // they cannot be compared to our romanized output and would score a false 0.
    if (!normalizeAncestor(real)) continue;

    const base = normalizeAncestor(entry.best.form);
    if (!base) continue;
    const { result, derivation } = applyRules(base, profile.rules);
    const ours = mapToInventory(result, profile.inventory);
    if (!ours) continue;
    const finalSim = formSimilarity(ours, real);

    // Waypoint bonus: does the raw derivation trajectory pass near a real
    // intermediate form for this branch?
    let conceptScore = finalSim;
    if (waypointLangs.length > 0) {
      const trajectory = [base, ...derivation.map((d) => d.after)];
      const waypointForms = [entry.best, ...entry.alternates]
        .filter((c) => waypointLangs.includes(c.lang))
        .map((c) => normalizeAncestor(c.form))
        .filter((f) => f.length > 0)
        .slice(0, 3);
      if (waypointForms.length > 0) {
        const wpScore =
          waypointForms.reduce((acc, f) => acc + bestTrajectorySimilarity(trajectory, f), 0) / waypointForms.length;
        conceptScore = (1 - WAYPOINT_WEIGHT) * finalSim + WAYPOINT_WEIGHT * wpScore;
      }
    }

    sum += conceptScore;
    examples.push({ concept, ours, real, similarity: round(conceptScore) });
  }
  const coverage = examples.length;
  if (coverage < MIN_LEXICAL_COVERAGE) return null;
  examples.sort((a, b) => b.similarity - a.similarity || a.concept.localeCompare(b.concept));
  return { score: sum / coverage, coverage, examples };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Score a single generated profile against a target. When lexical context is
 * provided (and coverage is sufficient), lexical fidelity dominates the overall
 * score; otherwise the phoneme inventory does. Typology is dropped and the
 * remaining weights renormalized when the target has no reference grammar.
 */
export function scoreProfile(
  profile: GeneratedProfile,
  target: MatchTarget,
  lexCtx?: LexicalContext,
): Omit<SeedMatch, 'seed' | 'style'> {
  const cons = overlap(baseSet(profile.consonantsIpa), baseSet(target.consonants));
  const vow = overlap(baseSet(profile.vowelsIpa), baseSet(target.vowels));
  const phonemeScore = 0.7 * cons.score + 0.3 * vow.score;

  const refPhon = TARGET_PHONOTACTICS[target.name] ?? DEFAULT_TARGET_PHONOTACTICS;
  const phonotacticsScore = phonotacticsSim(profile.phonotactics, refPhon);

  const refName = REFERENCE_BY_NAME[target.name] ?? null;
  const typologyScore =
    refName !== null
      ? (compareLanguageDNA(profile.grammar).find((m) => m.name === refName)?.similarity ?? 0)
      : null;

  const lexical = lexCtx ? computeLexical(profile, lexCtx) : null;

  // Weight the components; lexical fidelity leads when we have reflex data.
  const weights = lexical
    ? { lexical: 0.7, phonemes: 0.15, typology: 0.1, phonotactics: 0.05 }
    : { lexical: 0, phonemes: 0.6, typology: 0.25, phonotactics: 0.15 };
  let wTotal = weights.phonemes + weights.phonotactics;
  let wSum = weights.phonemes * phonemeScore + weights.phonotactics * phonotacticsScore;
  if (lexical) {
    wTotal += weights.lexical;
    wSum += weights.lexical * lexical.score;
  }
  if (typologyScore !== null) {
    wTotal += weights.typology;
    wSum += weights.typology * typologyScore;
  }
  const score = wTotal > 0 ? wSum / wTotal : 0;

  return {
    score: round(score),
    phonemeScore: round(phonemeScore),
    typologyScore: typologyScore === null ? null : round(typologyScore),
    phonotacticsScore: round(phonotacticsScore),
    lexicalScore: lexical ? round(lexical.score) : null,
    lexicalCoverage: lexical ? lexical.coverage : 0,
    examples: lexical ? lexical.examples.slice(0, 8) : [],
    matched: [...cons.shared, ...vow.shared],
    missing: [...cons.missing, ...vow.missing],
    extra: [...cons.extra, ...vow.extra],
  };
}

const SEED_ONSETS = ['b', 'd', 'f', 'g', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'z'];
const SEED_VOWELS = ['a', 'e', 'i', 'o', 'u'];

/** Deterministic pool of pronounceable candidate seeds. */
export function makeCandidateSeeds(count: number): string[] {
  const rng = new Rng('magpie::seed-search');
  const seeds = new Set<string>();
  let guard = 0;
  while (seeds.size < count && guard < count * 20) {
    guard++;
    const syllables = rng.int(2, 3);
    let word = '';
    for (let i = 0; i < syllables; i++) word += rng.pick(SEED_ONSETS) + rng.pick(SEED_VOWELS);
    seeds.add(word);
  }
  return [...seeds];
}

const HARSHNESS_GRID = [0.15, 0.5, 0.85];
const COMPLEXITY_GRID = [0.2, 0.5, 0.85];

function buildStyleGrid(branchName?: string): StyleOptions[] {
  const branches: (string | undefined)[] = branchName ? [undefined, branchName] : [undefined];
  const styles: StyleOptions[] = [];
  for (const branch of branches) {
    for (const harshness of HARSHNESS_GRID) {
      for (const complexity of COMPLEXITY_GRID) {
        styles.push({ branch, harshness, complexity });
      }
    }
  }
  return styles;
}

function styleKey(s: StyleOptions): string {
  return `${s.branch ?? ''}|${s.harshness ?? ''}|${s.complexity ?? ''}`;
}

/**
 * Search candidate seeds (optionally sweeping style knobs) and return the top-K
 * distinct seeds ranked by closeness to the target. Fully deterministic.
 */
export function findClosestSeeds(target: MatchTarget, data: MatchData, opts: FindOptions = {}): SeedMatch[] {
  const topK = opts.topK ?? 6;
  const sweep = opts.sweepStyle ?? true;

  // Lexical scoring is the heaviest part; default to fewer seeds when it is active.
  const reflexMap = data.reflexes?.[target.name];
  const lexCtx: LexicalContext | undefined =
    data.ancestorIndex && reflexMap && Object.keys(reflexMap).length > 0
      ? { ancestorIndex: data.ancestorIndex, reflexes: reflexMap, waypointLangs: waypointLangsFor(target.name) }
      : undefined;
  const seedCount = opts.seedCount ?? (lexCtx ? 150 : 200);

  const sourceExists = data.inventories.some((i) => i.name === target.name);
  const styles = sweep ? buildStyleGrid(sourceExists ? target.name : undefined) : [{}];
  const seeds = makeCandidateSeeds(seedCount);

  const results: SeedMatch[] = [];
  for (const seed of seeds) {
    for (const style of styles) {
      const profile = buildProfile(seed, data, style);
      results.push({ seed, style, ...scoreProfile(profile, target, lexCtx) });
    }
  }

  results.sort(
    (a, b) => b.score - a.score || a.seed.localeCompare(b.seed) || styleKey(a.style).localeCompare(styleKey(b.style)),
  );

  const seen = new Set<string>();
  const distinct: SeedMatch[] = [];
  for (const r of results) {
    if (seen.has(r.seed)) continue;
    seen.add(r.seed);
    distinct.push(r);
    if (distinct.length >= topK) break;
  }
  return distinct;
}
