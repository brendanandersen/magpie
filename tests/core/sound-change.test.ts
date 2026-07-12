import { describe, it, expect } from 'vitest';
import {
  normalizeAncestor,
  applyRule,
  applyRules,
  buildSoundChanges,
  buildEvolvedSoundChanges,
  hasBranchAnchors,
  classifyProcess,
  generateGenerationRules,
} from '../../src/core/sound-change.js';
import { Rng } from '../../src/core/rng.js';
import { resolveStyle } from '../../src/core/language.js';
import type { SoundChangeRule } from '../../src/core/language.js';

describe('normalizeAncestor', () => {
  it('strips reconstruction marks, laryngeals, accents and length', () => {
    expect(normalizeAncestor('*méh₂tēr')).toBe('meter');
    expect(normalizeAncestor('*bʰréh₂tēr')).toBe('bhreter');
  });

  it('vocalizes PIE syllabic resonants (r̥ l̥ m̥ n̥ → uR) instead of deleting them', () => {
    // The syllabic ring marks the resonant as the syllable nucleus: it carries an
    // inherent vowel that surfaces in the daughters (Germanic r̥ → ur, e.g. *wr̥dʰom → word).
    // Dropping it removes the medial vowel a real evolution needs, so we preserve it.
    expect(normalizeAncestor('*wódr̥')).toBe('wodur');
    expect(normalizeAncestor('*kʷr̥tós')).toBe('kwurtos');
    expect(normalizeAncestor('*wĺ̥kʷos')).toBe('wulkwos');
    expect(normalizeAncestor('*h₁nómn̥')).toBe('nomun');
  });

  it('produces only lowercase [a-z] output', () => {
    expect(normalizeAncestor('*wĺ̥kʷos')).toMatch(/^[a-z]+$/);
    expect(normalizeAncestor('*h₁nómn̥')).toMatch(/^[a-z]*$/);
  });
});

describe('applyRule', () => {
  const anyRule: SoundChangeRule = { id: 'p_f', description: 'p→f', from: 'p', to: 'f', env: 'any' };
  const finalRule: SoundChangeRule = { id: 'fa', description: 'final a', from: 'a', to: '', env: 'final' };
  const interRule: SoundChangeRule = { id: 's_r', description: 's→r', from: 's', to: 'r', env: 'intervocalic' };
  const initRule: SoundChangeRule = { id: 'k_g', description: 'k→g#', from: 'k', to: 'g', env: 'initial' };

  it('applies "any" globally', () => {
    expect(applyRule('papa', anyRule)).toBe('fafa');
  });

  it('applies "final" only at the end', () => {
    expect(applyRule('mata', finalRule)).toBe('mat');
    expect(applyRule('atma', finalRule)).toBe('atm');
  });

  it('applies "intervocalic" only between vowels', () => {
    expect(applyRule('asa', interRule)).toBe('ara');
    expect(applyRule('sas', interRule)).toBe('sas');
  });

  it('applies "initial" only at the start', () => {
    expect(applyRule('kak', initRule)).toBe('gak');
  });
});

describe('applyRules', () => {
  it('records a derivation step per change and chains in order', () => {
    const rules: SoundChangeRule[] = [
      { id: 't_th', description: 't→th', from: 't', to: 'th', env: 'any' },
      { id: 'd_t', description: 'd→t', from: 'd', to: 't', env: 'any' },
    ];
    const { result, derivation } = applyRules('deta', rules);
    // t→th first (deta→detha), then d→t (detha→tetha)
    expect(result).toBe('tetha');
    expect(derivation.map((d) => d.ruleId)).toEqual(['t_th', 'd_t']);
  });

  it('skips rules that do not match (no derivation step)', () => {
    const rules: SoundChangeRule[] = [
      { id: 'z_s', description: 'z→s', from: 'z', to: 's', env: 'any' },
    ];
    const { result, derivation } = applyRules('mata', rules);
    expect(result).toBe('mata');
    expect(derivation).toHaveLength(0);
  });
});

describe('branch anchors', () => {
  it('reports which branches have defining laws', () => {
    expect(hasBranchAnchors('German')).toBe(true);
    expect(hasBranchAnchors('')).toBe(false);
    expect(hasBranchAnchors('Klingon')).toBe(false);
  });

  it('adds no anchor rules when no branch is set', () => {
    const rules = buildEvolvedSoundChanges('seed', resolveStyle({ generations: 3 }));
    expect(rules.some((r) => r.id.startsWith('anchor_'))).toBe(false);
    expect(new Set(rules.map((r) => r.generation))).toEqual(new Set([1, 2, 3]));
  });

  it('brackets the generative generations with early (gen 0) and late (final) anchors for a real branch', () => {
    const rules = buildEvolvedSoundChanges('seed', resolveStyle({ branch: 'German', generations: 3 }));
    const early = rules.filter((r) => r.id.startsWith('anchor_German_early'));
    const late = rules.filter((r) => r.id.startsWith('anchor_German_late'));
    expect(early.length).toBeGreaterThan(0);
    expect(late.length).toBeGreaterThan(0);
    // early anchors are the Proto-language stage (generation 0), before any generative gen
    expect(early.every((r) => r.generation === 0)).toBe(true);
    // late anchors run after the last generative generation
    expect(late.every((r) => r.generation === 4)).toBe(true);
    // signature laws are present: Germanic o→a, Grimm d→t, High German intervocalic t→ss
    expect(early.some((r) => r.from === 'o' && r.to === 'a')).toBe(true);
    expect(early.some((r) => r.from === 'd' && r.to === 't' && r.env === 'any')).toBe(true);
    expect(late.some((r) => r.from === 't' && r.to === 's' && r.env === 'intervocalic')).toBe(true);
  });

  it('carries the German water trajectory *wódr̥ → wasur (≈ Wasser) via anchors alone', () => {
    const rules = buildEvolvedSoundChanges('seed', resolveStyle({ branch: 'German', generations: 3 }));
    // Isolate the always-on anchors from per-seed generative variety.
    const anchorsOnly = rules.filter((r) => r.id.startsWith('anchor_German'));
    const base = normalizeAncestor('*wódr̥'); // 'wodur'
    const { result } = applyRules(base, anchorsOnly);
    expect(result).toBe('wasur');
  });

  it('is deterministic for a branch-anchored seed + style', () => {
    const s = resolveStyle({ branch: 'German', generations: 4 });
    expect(buildEvolvedSoundChanges('abc', s)).toEqual(buildEvolvedSoundChanges('abc', s));
  });

  it('recognizes every branch that has an anchor set', () => {
    for (const b of ['German', 'English', 'Icelandic', 'Sanskrit', 'Greek', 'Russian', 'French']) {
      expect(hasBranchAnchors(b)).toBe(true);
    }
    expect(hasBranchAnchors('Latin')).toBe(false);
  });

  // Isolate a branch's always-on anchors from per-seed generative variety.
  const anchorsFor = (branch: string) =>
    buildEvolvedSoundChanges('seed', resolveStyle({ branch, generations: 2 })).filter((r) =>
      r.id.startsWith('anchor_'),
    );

  it('deaspirates the PIE breathy-voiced series in Germanic branches (bʰ→b, not →pf)', () => {
    // *bʰréh₂tēr → base "bhreter"; must become b-initial (Bruder), never pf-.
    expect(applyRules('bhreter', anchorsFor('German')).result).toBe('breser');
    expect(applyRules('bhreter', anchorsFor('Icelandic')).result).toBe('breter');
  });

  it('applies the High German shift to German but not to the other Germanic branches', () => {
    const water = normalizeAncestor('*wódr̥'); // 'wodur'
    expect(applyRules(water, anchorsFor('German')).result).toBe('wasur'); // HG t→ss
    expect(applyRules(water, anchorsFor('Icelandic')).result).toBe('watur'); // North Germanic, no HG shift
    expect(applyRules(water, anchorsFor('English')).result).toBe('watur'); // West Germanic, no HG shift
  });

  it('merges PIE *e/*o/*a → a and *l → r for Sanskrit (Indo-Iranian)', () => {
    expect(applyRules('woletos', anchorsFor('Sanskrit')).result).toBe('waratas');
  });

  it('turns PIE voiced aspirates into voiceless aspirates and initial *s → h for Greek', () => {
    expect(applyRules('bhedh', anchorsFor('Greek')).result).toBe('pheth');
    expect(applyRules('septm', anchorsFor('Greek')).result).toBe('heptm');
  });

  it('loses the PIE breathy-voiced series for Russian (Balto-Slavic)', () => {
    expect(applyRules('bhedhogh', anchorsFor('Russian')).result).toBe('bedog');
  });

  it('applies Latin→French lenition (c→s before front, intervocalic voicing, final loss)', () => {
    expect(applyRules('keto', anchorsFor('French')).result).toBe('sed');
  });

  it('tags anchor rules with their historical sound-law name', () => {
    const laws = (branch: string) => anchorsFor(branch).map((r) => r.law);
    expect(laws('German')).toContain('High German consonant shift');
    expect(laws('German')).toContain("Grimm's law (voiced-stop devoicing)");
    expect(laws('German')).toContain('Deaspiration of the PIE breathy-voiced series');
    expect(laws('Greek')).toContain('Devoicing of the PIE voiced aspirates');
    expect(laws('Russian')).toContain('Loss of the PIE breathy-voiced series');
    // Every anchor rule carries a law name.
    expect(anchorsFor('French').every((r) => typeof r.law === 'string' && r.law.length > 0)).toBe(true);
  });
});

describe('classifyProcess', () => {
  it('names general (branch-agnostic) phonological processes', () => {
    expect(classifyProcess('d', 't', 'any')).toBe('Devoicing (fortition)');
    expect(classifyProcess('t', 'd', 'intervocalic')).toBe('Voicing (lenition)');
    expect(classifyProcess('t', 's', 'intervocalic')).toBe('Spirantization (lenition)');
    expect(classifyProcess('t', 'ts', 'initial')).toBe('Affrication');
    expect(classifyProcess('bh', 'b', 'any')).toBe('Deaspiration');
    expect(classifyProcess('s', 'r', 'intervocalic')).toBe('Rhotacism');
    expect(classifyProcess('s', 'h', 'any')).toBe('Debuccalization (→ h)');
    expect(classifyProcess('f', 'h', 'any')).toBe('Debuccalization (→ h)');
    expect(classifyProcess('s', 'z', 'intervocalic')).toBe('Voicing (lenition)'); // fricative voicing
    expect(classifyProcess('s', 'sh', 'before_front')).toBe('Palatalization (before a front vowel)');
    expect(classifyProcess('g', 'j', 'before_front')).toBe('Palatalization (before a front vowel)');
    expect(classifyProcess('a', 'e', 'before_front')).toBe('Umlaut (fronting before a front vowel)');
    expect(classifyProcess('o', 'e', 'any')).toBe('Vowel fronting/raising'); // back → front
    expect(classifyProcess('e', 'i', 'any')).toBe('Vowel shift'); // front → front
    expect(classifyProcess('a', '', 'final')).toBe('Apocope (loss of a final vowel)');
    expect(classifyProcess('t', '', 'final')).toBe('Loss of a final consonant');
  });

  it('returns undefined for changes with no recognizable general process', () => {
    expect(classifyProcess('x', 'q', 'any')).toBeUndefined();
  });

  it('does NOT call the generic devoicing rule "Grimm\'s law" (that is branch-specific)', () => {
    expect(classifyProcess('d', 't', 'any')).not.toMatch(/grimm/i);
  });

  it('tags every generated rule with a general process name', () => {
    // Every generator produces a change classifyProcess recognizes, so no rule is unlabeled.
    for (const seed of ['proc-a', 'proc-b', 'proc-c', 'proc-d', 'proc-e']) {
      const rules = generateGenerationRules(new Rng(seed), resolveStyle({ complexity: 0.9 }), 1);
      expect(rules.every((r) => typeof r.law === 'string' && r.law.length > 0)).toBe(true);
    }
  });
});

describe('buildSoundChanges', () => {
  it('is deterministic for a given seed', () => {
    const a = buildSoundChanges(new Rng('lang-1'));
    const b = buildSoundChanges(new Rng('lang-1'));
    expect(a).toEqual(b);
  });

  it('selects between 5 and 9 rules preserving pool order', () => {
    const rules = buildSoundChanges(new Rng('lang-2'));
    expect(rules.length).toBeGreaterThanOrEqual(5);
    expect(rules.length).toBeLessThanOrEqual(9);
  });
});
