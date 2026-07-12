/**
 * Sound-change engine: normalizes an ancestor form (e.g. a PIE reconstruction)
 * into a clean romanized base, then applies an ordered list of regular sound-change
 * rules, recording each application as a derivation step. Rule sets are generated
 * procedurally from a seed (see buildSoundChanges).
 */

import { Rng } from './rng.js';
import { resolveStyle, type DerivationStep, type SoundChangeRule, type Style } from './language.js';

const MULTI_MAP: [RegExp, string][] = [
  [/gʷʰ/g, 'gw'],
  [/bʰ/g, 'bh'],
  [/dʰ/g, 'dh'],
  [/ǵʰ/g, 'gh'],
  [/gʰ/g, 'gh'],
  [/kʷ/g, 'kw'],
  [/gʷ/g, 'gw'],
  [/ǵ/g, 'g'],
  [/ḱ/g, 'k'],
];

/**
 * Convert a raw ancestor form into a lowercase romanized base of [a-z] segments.
 * Strips reconstruction marks, laryngeals, accents/length, and maps IE notation
 * to the shared alphabet.
 */
export function normalizeAncestor(form: string): string {
  let s = form.trim().replace(/^\*/, '').replace(/-/g, '');
  for (const [re, rep] of MULTI_MAP) s = s.replace(re, rep);
  s = s.replace(/ʰ/g, 'h').replace(/ʷ/g, 'w').replace(/ʲ/g, 'y');
  // laryngeals and subscript-marked segments
  s = s.replace(/h[₀-₉]/g, '').replace(/H/g, '').replace(/[₀-₉]/g, '');
  s = s.normalize('NFD');
  // Vocalize PIE syllabic resonants: the ring/vertical-line-below (U+0325/U+0329)
  // marks a resonant as the syllable nucleus, so it carries an inherent vowel that
  // surfaces in the daughter languages (Germanic r̥ → ur, e.g. *wr̥dʰom → "word").
  // Preserve that vowel as `uR` rather than deleting it with the other diacritics —
  // without it there is no medial vowel for later rules (e.g. High German t → ss)
  // to act on, and forms like *wódr̥ could never reach *watar → "Wasser".
  s = s.replace(/([rlmn])[\u0325\u0329]/gi, (_m, c: string) => `u${c}`);
  // strip remaining combining diacritics (accents, macrons, length)
  s = s.replace(/[\u0300-\u036f]/g, '');
  s = s.toLowerCase();
  s = s
    .replace(/þ/g, 'th')
    .replace(/ð/g, 'dh')
    .replace(/[øœ]/g, 'o')
    .replace(/æ/g, 'a')
    .replace(/ə/g, 'e')
    .replace(/[ʔ']/g, '');
  s = s.replace(/[^a-z]/g, '');
  return s;
}

const V = '[aeiouy]';

function ruleRegex(rule: SoundChangeRule): { re: RegExp; replacer: (m: string, ...g: string[]) => string } {
  const from = rule.from;
  switch (rule.env) {
    case 'initial':
      return { re: new RegExp(`^${from}`), replacer: () => rule.to };
    case 'final':
      return { re: new RegExp(`${from}$`), replacer: () => rule.to };
    case 'intervocalic':
      return {
        re: new RegExp(`(${V})${from}(${V})`, 'g'),
        replacer: (_m, a: string, b: string) => `${a}${rule.to}${b}`,
      };
    case 'before_front':
      return { re: new RegExp(`${from}(?=[iey])`, 'g'), replacer: () => rule.to };
    case 'any':
    default:
      return { re: new RegExp(from, 'g'), replacer: () => rule.to };
  }
}

/** Apply a single rule; returns the new word (unchanged if it does not match). */
export function applyRule(word: string, rule: SoundChangeRule): string {
  const { re, replacer } = ruleRegex(rule);
  return word.replace(re, replacer as (substring: string, ...args: unknown[]) => string);
}

/** Apply an ordered rule list, collecting a derivation step for each change. */
export function applyRules(
  base: string,
  rules: SoundChangeRule[],
): { result: string; derivation: DerivationStep[] } {
  let current = base;
  const derivation: DerivationStep[] = [];
  for (const rule of rules) {
    const after = applyRule(current, rule);
    if (after !== current) {
      derivation.push({ ruleId: rule.id, description: rule.description, before: current, after });
      current = after;
    }
  }
  return { result: current, derivation };
}

/**
 * The pool of plausible sound-change templates, ordered by rough relative
 * chronology (aspirate simplification -> stop shifts -> lenition -> glides ->
 * vowel shifts -> deletions/final effects). buildSoundChanges samples from this.
 */
const RULE_POOL: SoundChangeRule[] = [
  { id: 'deaspirate_bh', description: 'bʰ → b', from: 'bh', to: 'b', env: 'any' },
  { id: 'deaspirate_dh', description: 'dʰ → d', from: 'dh', to: 'd', env: 'any' },
  { id: 'deaspirate_gh', description: 'gʰ → g', from: 'gh', to: 'g', env: 'any' },
  { id: 'grimm_p_f', description: 'p → f', from: 'p', to: 'f', env: 'any' },
  { id: 'grimm_t_th', description: 't → th', from: 't', to: 'th', env: 'any' },
  { id: 'grimm_k_kh', description: 'k → kh', from: 'k', to: 'kh', env: 'any' },
  { id: 'grimm_b_p', description: 'b → p', from: 'b', to: 'p', env: 'any' },
  { id: 'grimm_d_t', description: 'd → t', from: 'd', to: 't', env: 'any' },
  { id: 'grimm_g_k', description: 'g → k', from: 'g', to: 'k', env: 'any' },
  { id: 'hg_t_s', description: 't → ss between vowels (High German)', from: 't', to: 's', env: 'intervocalic' },
  { id: 'hg_t_ts', description: 't → z word-initially (High German)', from: 't', to: 'ts', env: 'initial' },
  { id: 'hg_p_f', description: 'p → f between vowels (High German)', from: 'p', to: 'f', env: 'intervocalic' },
  { id: 'hg_k_kh', description: 'k → ch (High German)', from: 'k', to: 'kh', env: 'intervocalic' },
  { id: 'lenite_t_d', description: 't → d between vowels', from: 't', to: 'd', env: 'intervocalic' },
  { id: 'lenite_k_g', description: 'k → g between vowels', from: 'k', to: 'g', env: 'intervocalic' },
  { id: 'rhotacism', description: 's → r between vowels', from: 's', to: 'r', env: 'intervocalic' },
  { id: 'kw_p', description: 'kʷ → p', from: 'kw', to: 'p', env: 'any' },
  { id: 'kw_k', description: 'kʷ → k', from: 'kw', to: 'k', env: 'any' },
  { id: 'gw_w', description: 'gʷ → w', from: 'gw', to: 'w', env: 'any' },
  { id: 'h_loss', description: 'h → ∅', from: 'h', to: '', env: 'any' },
  { id: 'umlaut_a_e', description: 'a → e before a front vowel (i-umlaut)', from: 'a', to: 'e', env: 'before_front' },
  { id: 'umlaut_u_y', description: 'u → ü before a front vowel (i-umlaut)', from: 'u', to: 'y', env: 'before_front' },
  { id: 'vowel_a_o', description: 'a → o', from: 'a', to: 'o', env: 'any' },
  { id: 'vowel_o_a', description: 'o → a (Germanic o/a merger)', from: 'o', to: 'a', env: 'any' },
  { id: 'vowel_e_i', description: 'e → i', from: 'e', to: 'i', env: 'any' },
  { id: 'vowel_o_u', description: 'o → u', from: 'o', to: 'u', env: 'any' },
  { id: 'apocope_e', description: 'final e → ∅', from: 'e', to: '', env: 'final' },
  { id: 'apocope_a', description: 'final a → ∅', from: 'a', to: '', env: 'final' },
  { id: 'final_devoice_d', description: 'final d → t', from: 'd', to: 't', env: 'final' },
  { id: 'final_devoice_g', description: 'final g → k', from: 'g', to: 'k', env: 'final' },
];

/** How "harsh" (fortition/devoicing) vs "soft" (lenition) each rule is, 0..1. */
const RULE_HARSHNESS: Record<string, number> = {
  grimm_p_f: 0.8, grimm_t_th: 0.9, grimm_k_kh: 0.9,
  hg_t_s: 0.6, hg_t_ts: 0.75, hg_p_f: 0.6, hg_k_kh: 0.7,
  umlaut_a_e: 0.5, umlaut_u_y: 0.5, vowel_o_a: 0.5,
  final_devoice_d: 0.7, final_devoice_g: 0.7, kw_k: 0.6,
  lenite_t_d: 0.2, lenite_k_g: 0.2, rhotacism: 0.3, gw_w: 0.2, kw_p: 0.4, h_loss: 0.4,
};

const APOCOPE = ['apocope_e', 'apocope_a'];

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Procedurally choose an ordered rule set for one language, biased by style:
 * `complexity` sets how many rules, `harshness` biases fortition vs lenition, and
 * `wordLength` forces apocope in ('short') or excludes it ('long'). The result
 * always preserves pool order (relative chronology).
 */
export function buildSoundChanges(rng: Rng, style: Style = resolveStyle()): SoundChangeRule[] {
  const count = clamp(Math.round(rng.int(5, 9) + (style.complexity - 0.5) * 6), 3, RULE_POOL.length);
  const h = style.harshness;
  const weight = (r: SoundChangeRule) => {
    const hv = RULE_HARSHNESS[r.id] ?? 0.5;
    return hv * h + (1 - hv) * (1 - h) + 0.05;
  };

  const remaining = [...RULE_POOL];
  const chosen = new Set<string>();
  while (chosen.size < count && remaining.length > 0) {
    const pick = rng.weightedPick(remaining, weight);
    chosen.add(pick.id);
    remaining.splice(remaining.indexOf(pick), 1);
  }

  if (style.wordLength === 'short') {
    for (const id of [...APOCOPE, 'h_loss']) chosen.add(id);
  } else if (style.wordLength === 'long') {
    for (const id of APOCOPE) chosen.delete(id);
  }

  return RULE_POOL.filter((r) => chosen.has(r.id));
}

/** The full library of available sound-change rules (copies), for manual authoring. */
export function getRulePool(): SoundChangeRule[] {
  return RULE_POOL.map((r) => {
    const process = classifyProcess(r.from, r.to, r.env);
    return process ? { ...r, law: process } : { ...r };
  });
}

// --- Multi-generation evolution (iterated, generative sound change) ---

type Env = SoundChangeRule['env'];
interface RuleCore {
  from: string;
  to: string;
  env: Env;
  /** Optional historical name of the sound law this rule represents. */
  law?: string;
}

const ALL_VOWELS = ['a', 'e', 'i', 'o', 'u', 'y'];

function pair(rng: Rng, pairs: [string, string][]): RuleCore | null {
  const [from, to] = rng.pick(pairs);
  return { from, to, env: 'any' };
}

/** A generator produces one plausible sound change; `harsh` biases selection by style.harshness. */
interface Generator {
  harsh: number;
  make: (rng: Rng, style: Style) => RuleCore | null;
}

const GENERATORS: Generator[] = [
  // neutral vowel shift (the main variety driver for short words)
  {
    harsh: 0.5,
    make: (rng) => {
      const from = rng.pick(ALL_VOWELS);
      const to = rng.pick(ALL_VOWELS.filter((v) => v !== from));
      return { from, to, env: 'any' };
    },
  },
  // soft: intervocalic voicing
  { harsh: 0.2, make: (rng) => ({ ...pair(rng, [['p', 'b'], ['t', 'd'], ['k', 'g'], ['s', 'z'], ['f', 'v']])!, env: 'intervocalic' }) },
  // soft: intervocalic spirantization (lenition)
  { harsh: 0.3, make: (rng) => ({ ...pair(rng, [['p', 'f'], ['t', 'th'], ['k', 'kh'], ['b', 'v'], ['d', 'dh'], ['g', 'gh']])!, env: 'intervocalic' }) },
  // soft: debuccalization
  { harsh: 0.35, make: (rng) => ({ ...pair(rng, [['s', 'h'], ['f', 'h'], ['th', 'h']])!, env: 'any' }) },
  // soft: rhotacism
  { harsh: 0.3, make: () => ({ from: 's', to: 'r', env: 'intervocalic' }) },
  // soft: h-loss
  { harsh: 0.4, make: () => ({ from: 'h', to: '', env: 'any' }) },
  // harsh: palatalization before front vowels
  { harsh: 0.7, make: (rng) => ({ ...pair(rng, [['k', 'sh'], ['g', 'j'], ['t', 'sh'], ['s', 'sh']])!, env: 'before_front' }) },
  // harsh: final devoicing
  { harsh: 0.7, make: (rng) => ({ ...pair(rng, [['b', 'p'], ['d', 't'], ['g', 'k']])!, env: 'final' }) },
  // harsh: fortition / spirantization anywhere
  { harsh: 0.8, make: (rng) => ({ ...pair(rng, [['p', 'f'], ['t', 'th'], ['k', 'kh'], ['b', 'p'], ['d', 't'], ['g', 'k']])!, env: 'any' }) },
  // High German consonant shift, intervocalic fricativization (t→s, p→f, k→kh): watar → wasar (Wasser)
  { harsh: 0.6, make: (rng) => ({ ...pair(rng, [['t', 's'], ['p', 'f'], ['k', 'kh']])!, env: 'intervocalic' }) },
  // High German consonant shift, initial affrication (t→ts, p→pf, k→kh): tanþ → tsanth (Zahn)
  { harsh: 0.75, make: (rng) => ({ ...pair(rng, [['t', 'ts'], ['p', 'pf'], ['k', 'kh']])!, env: 'initial' }) },
  // i-umlaut: back/low vowels front before a front vowel (a→e, o→e, u→y)
  { harsh: 0.5, make: (rng) => ({ ...pair(rng, [['a', 'e'], ['o', 'e'], ['u', 'y']])!, env: 'before_front' }) },
  // neutral: final consonant loss
  { harsh: 0.5, make: (rng) => ({ from: rng.pick(['t', 'd', 'n', 'm', 's', 'r']), to: '', env: 'final' }) },
  // neutral: apocope (suppressed for long word style)
  {
    harsh: 0.5,
    make: (rng, style) => (style.wordLength === 'long' ? null : { from: rng.pick(['a', 'e', 'i', 'o', 'u']), to: '', env: 'final' }),
  },
];

/**
 * Defining, always-on sound laws for a real branch. Unlike the per-seed generative
 * rules (which supply variety), these anchor a branch to its characteristic historical
 * trajectory, so ANY seed on that branch reliably "feels" like the target language and
 * carries its signature reflexes (e.g. German `water` *wódr̥ → *Wasser*). `early` laws
 * apply before the seed's generative generations (Proto-language stage); `late` laws
 * after them (younger, branch-defining shifts). We never seed a derivation from a recent
 * ancestor — anchors are just extra rules on the full PIE→modern chain.
 */
interface BranchAnchors {
  early: RuleCore[];
  late: RuleCore[];
}

// Shared Proto-Germanic stage: PIE /o/→/a/ merger + the safe (voiced-stop devoicing) half
// of Grimm's law. The voiceless→fricative half (p→f/t→þ/k→x) is conditioned by Verner's
// law on PIE accent (which normalization strips), so it over-applies and is left to the
// generative pool.
const DEASPIRATION = 'Deaspiration of the PIE breathy-voiced series';
const GRIMM = "Grimm's law (voiced-stop devoicing)";

const PROTO_GERMANIC_EARLY: RuleCore[] = [
  // Deaspirate the PIE breathy-voiced series into plain voiced stops FIRST, so the
  // digraphs (bh/dh/gh) don't get caught by the voiced-stop devoicing below
  // (PIE bʰ→b gives Germanic "Bruder", not *pf-).
  { from: 'bh', to: 'b', env: 'any', law: DEASPIRATION },
  { from: 'dh', to: 'd', env: 'any', law: DEASPIRATION },
  { from: 'gh', to: 'g', env: 'any', law: DEASPIRATION },
  { from: 'o', to: 'a', env: 'any', law: 'Germanic o/a merger' },
  // Grimm's law, voiced-stop devoicing (the safe half; voiceless→fricative is left to the
  // generative pool because Verner's law needs PIE accent that normalization strips).
  { from: 'd', to: 't', env: 'any', law: GRIMM },
  { from: 'g', to: 'k', env: 'any', law: GRIMM },
];

const BRANCH_ANCHORS: Record<string, BranchAnchors> = {
  German: {
    early: PROTO_GERMANIC_EARLY,
    late: [
      // High German consonant shift (the branch's signature): post-vocalic voiceless
      // stops → fricatives, word-initial → affricates.
      { from: 't', to: 's', env: 'intervocalic', law: 'High German consonant shift' }, // watar → wasar (Wasser)
      { from: 'p', to: 'f', env: 'intervocalic', law: 'High German consonant shift' },
      { from: 'k', to: 'kh', env: 'intervocalic', law: 'High German consonant shift' },
      { from: 't', to: 'ts', env: 'initial', law: 'High German consonant shift' }, // tanþ → Zahn
      { from: 'p', to: 'pf', env: 'initial', law: 'High German consonant shift' },
      // i-umlaut: back/low vowels front before a front vowel.
      { from: 'a', to: 'e', env: 'before_front', law: 'i-umlaut' },
      { from: 'u', to: 'y', env: 'before_front', law: 'i-umlaut' },
      // Final devoicing (Auslautverhärtung).
      { from: 'd', to: 't', env: 'final', law: 'Final devoicing (Auslautverhärtung)' },
      { from: 'g', to: 'k', env: 'final', law: 'Final devoicing (Auslautverhärtung)' },
    ],
  },

  // West Germanic: the Proto-Germanic stage without the High German shift, so it keeps its
  // stops (English "water"/"ten", not "Wasser"/"zehn"); plus loss of most final short vowels.
  English: {
    early: PROTO_GERMANIC_EARLY,
    late: [
      { from: 'e', to: '', env: 'final', law: 'Loss of final short vowels (apocope)' },
      { from: 'o', to: '', env: 'final', law: 'Loss of final short vowels (apocope)' },
    ],
  },

  // North Germanic: shares the Proto-Germanic stage with German but NOT the High German
  // consonant shift; keeps its stops and applies strong i-/u-umlaut.
  Icelandic: {
    early: PROTO_GERMANIC_EARLY,
    late: [
      { from: 'a', to: 'e', env: 'before_front', law: 'i-/u-umlaut' },
      { from: 'u', to: 'y', env: 'before_front', law: 'i-/u-umlaut' },
    ],
  },

  // Indo-Iranian: the great PIE *e/*o/*a → /a/ vowel merger, and *l → r.
  Sanskrit: {
    early: [
      { from: 'e', to: 'a', env: 'any', law: 'Indo-Iranian *e/*o/*a → a merger' },
      { from: 'o', to: 'a', env: 'any', law: 'Indo-Iranian *e/*o/*a → a merger' },
      { from: 'l', to: 'r', env: 'any', law: 'Indo-Iranian *l → r' },
    ],
    late: [],
  },

  // Hellenic: PIE voiced aspirates → voiceless aspirates; word-initial *s → h (*septm̥ → hepta).
  Greek: {
    early: [
      { from: 'bh', to: 'ph', env: 'any', law: 'Devoicing of the PIE voiced aspirates' },
      { from: 'dh', to: 'th', env: 'any', law: 'Devoicing of the PIE voiced aspirates' },
      { from: 'gh', to: 'kh', env: 'any', law: 'Devoicing of the PIE voiced aspirates' },
      { from: 's', to: 'h', env: 'initial', law: 'Initial *s → h (debuccalization)' },
    ],
    late: [],
  },

  // Balto-Slavic: loss of the PIE breathy-voiced series (bʰ→b, dʰ→d, gʰ→g).
  Russian: {
    early: [
      { from: 'bh', to: 'b', env: 'any', law: 'Loss of the PIE breathy-voiced series' },
      { from: 'dh', to: 'd', env: 'any', law: 'Loss of the PIE breathy-voiced series' },
      { from: 'gh', to: 'g', env: 'any', law: 'Loss of the PIE breathy-voiced series' },
    ],
    late: [],
  },

  // Gallo-Romance (PIE → Latin → French): deaspiration into the Latin stops, then the
  // Latin→French lenition trajectory (c→s before front vowels, intervocalic voicing,
  // loss of most final short vowels).
  French: {
    early: [
      { from: 'bh', to: 'b', env: 'any', law: 'Deaspiration into the Latin stops' },
      { from: 'dh', to: 'd', env: 'any', law: 'Deaspiration into the Latin stops' },
      { from: 'gh', to: 'g', env: 'any', law: 'Deaspiration into the Latin stops' },
    ],
    late: [
      { from: 'k', to: 's', env: 'before_front', law: 'Palatalization of Latin c before front vowels' }, // centum → cent
      { from: 'p', to: 'v', env: 'intervocalic', law: 'Intervocalic lenition (voicing)' },
      { from: 't', to: 'd', env: 'intervocalic', law: 'Intervocalic lenition (voicing)' },
      { from: 'k', to: 'g', env: 'intervocalic', law: 'Intervocalic lenition (voicing)' },
      { from: 'o', to: '', env: 'final', law: 'Loss of final short vowels (apocope)' },
      { from: 'u', to: '', env: 'final', law: 'Loss of final short vowels (apocope)' },
    ],
  },
};

const ANCHOR_LABEL: Record<string, string> = {
  German: 'German',
  English: 'English',
  Icelandic: 'Icelandic',
  Sanskrit: 'Sanskrit',
  Greek: 'Greek',
  Russian: 'Russian',
  French: 'French',
};

// General (branch-agnostic) phonological process classes. Unlike the named branch laws
// (Grimm's, High German shift, …), these describe the *type* of change a rule performs.
// E.g. `d → t` is generically "devoicing (fortition)"; it is only "Grimm's law" inside the
// Germanic branch, which is why named laws live on anchors and processes on generated rules.
const VOICED_STOPS = new Set(['b', 'd', 'g']);
const VOICELESS_STOPS = new Set(['p', 't', 'k']);
const ASPIRATES = new Set(['bh', 'dh', 'gh']);
const FRICATIVES = new Set(['f', 'v', 's', 'z', 'h', 'th', 'dh', 'kh', 'gh', 'sh', 'x', 'ph']);
const VOICELESS_FRICATIVES = new Set(['f', 's', 'th', 'sh', 'kh', 'x', 'ph']);
const VOICED_FRICATIVES = new Set(['v', 'z', 'dh', 'zh', 'gh']);
const AFFRICATES = new Set(['ts', 'pf', 'ch', 'dz', 'j']);
const PROC_VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);
const FRONT_VOWELS = new Set(['e', 'i', 'y']);

/**
 * Classify a raw sound change into a general phonological process name, or undefined when
 * it doesn't map to a recognizable process. Branch-agnostic on purpose (see comment above).
 */
export function classifyProcess(from: string, to: string, env: Env): string | undefined {
  if (to === '') {
    if (PROC_VOWELS.has(from)) return env === 'final' ? 'Apocope (loss of a final vowel)' : 'Vowel deletion';
    return env === 'final' ? 'Loss of a final consonant' : 'Elision (segment loss)';
  }
  if (ASPIRATES.has(from)) return VOICED_STOPS.has(to) ? 'Deaspiration' : 'Devoicing of an aspirate';
  // A consonant changing before a front vowel is (by definition) palatalization.
  if (env === 'before_front' && !PROC_VOWELS.has(from)) return 'Palatalization (before a front vowel)';
  if (to === 'h' && from !== 'h' && FRICATIVES.has(from)) return 'Debuccalization (→ h)';
  if (VOICED_STOPS.has(from) && VOICELESS_STOPS.has(to)) return 'Devoicing (fortition)';
  if (VOICELESS_STOPS.has(from) && VOICED_STOPS.has(to)) return 'Voicing (lenition)';
  if (VOICELESS_FRICATIVES.has(from) && VOICED_FRICATIVES.has(to)) return 'Voicing (lenition)'; // s→z, f→v
  if (VOICELESS_STOPS.has(from) && AFFRICATES.has(to)) return 'Affrication';
  if ((VOICELESS_STOPS.has(from) || VOICED_STOPS.has(from)) && FRICATIVES.has(to)) return 'Spirantization (lenition)';
  if (from === 's' && to === 'r') return 'Rhotacism';
  if ((from === 'l' && to === 'r') || (from === 'r' && to === 'l')) return 'Liquid shift';
  if (from === 'kw' || from === 'gw') return 'Labiovelar reduction';
  if (PROC_VOWELS.has(from) && PROC_VOWELS.has(to)) {
    if (env === 'before_front') return 'Umlaut (fronting before a front vowel)';
    if (FRONT_VOWELS.has(to) && !FRONT_VOWELS.has(from)) return 'Vowel fronting/raising';
    return 'Vowel shift';
  }
  return undefined;
}

function anchorRule(core: RuleCore, branch: string, phase: 'early' | 'late', i: number): SoundChangeRule {
  const label = ANCHOR_LABEL[branch] ?? branch;
  const envLabel = core.env === 'any' ? '' : ` /${core.env.replace('_', ' ')}`;
  return {
    id: `anchor_${branch}_${phase}_${i}_${core.from}_${core.to}_${core.env}`,
    description: `[${label}] ${core.from} → ${core.to || '∅'}${envLabel}`,
    from: core.from,
    to: core.to,
    env: core.env,
    ...(core.law ? { law: core.law } : {}),
  };
}

/** Generate one generation's worth of rules, biased by style, tagged with the generation index. */
export function generateGenerationRules(rng: Rng, style: Style, generation: number): SoundChangeRule[] {
  const count = rng.int(2, style.complexity >= 0.6 ? 4 : 3);
  const h = style.harshness;
  const weight = (g: Generator) => g.harsh * h + (1 - g.harsh) * (1 - h) + 0.05;

  const remaining = [...GENERATORS];
  const rules: SoundChangeRule[] = [];
  let i = 0;
  while (rules.length < count && remaining.length > 0) {
    const g = rng.weightedPick(remaining, weight);
    remaining.splice(remaining.indexOf(g), 1);
    const core = g.make(rng, style);
    if (!core || !core.from) continue;
    const envLabel = core.env === 'any' ? '' : ` /${core.env.replace('_', ' ')}`;
    const process = classifyProcess(core.from, core.to, core.env);
    rules.push({
      id: `gen${generation}_${i}_${core.from}_${core.to}_${core.env}`,
      description: `[gen ${generation}] ${core.from} → ${core.to || '∅'}${envLabel}`,
      from: core.from,
      to: core.to,
      env: core.env,
      generation,
      ...(process ? { law: process } : {}),
    });
    i++;
  }
  return rules;
}

/**
 * Whether a branch has defining always-on sound laws (see BRANCH_ANCHORS). Exposed so
 * callers/UI can indicate that a branch-anchored trajectory is in effect.
 */
export function hasBranchAnchors(branch: string): boolean {
  return branch in BRANCH_ANCHORS;
}

/**
 * Evolve a language's sound changes across `style.generations` iterated generations,
 * each drawing a fresh generative ruleset (chained cumulatively). Deterministic:
 * each generation is seeded from the master seed.
 *
 * When `style.branch` names a real branch with defining laws, those anchors bracket the
 * generative generations: `early` anchors run first (Proto-language stage, tagged
 * generation 0) and `late` anchors last (branch-defining shifts, tagged as the final
 * generation), so every seed on that branch reliably carries the branch's signature
 * trajectory while the generative middle still supplies per-seed variety.
 */
export function buildEvolvedSoundChanges(seed: string, style: Style): SoundChangeRule[] {
  const anchors = style.branch ? BRANCH_ANCHORS[style.branch] : undefined;
  const rules: SoundChangeRule[] = [];
  if (anchors) {
    rules.push(...anchors.early.map((c, i) => ({ ...anchorRule(c, style.branch, 'early', i), generation: 0 })));
  }
  for (let g = 1; g <= style.generations; g++) {
    const genRng = new Rng(`${seed}::gen::${g}`);
    rules.push(...generateGenerationRules(genRng, style, g));
  }
  if (anchors) {
    const lateGen = style.generations + 1;
    rules.push(...anchors.late.map((c, i) => ({ ...anchorRule(c, style.branch, 'late', i), generation: lateGen })));
  }
  return rules;
}

export const __RULE_POOL_FOR_TESTS = RULE_POOL;
