import { describe, it, expect } from 'vitest';
import {
  basePhoneme,
  baseSet,
  buildProfile,
  scoreProfile,
  makeCandidateSeeds,
  findClosestSeeds,
  formSimilarity,
  computeLexical,
  waypointLangsFor,
  type MatchData,
  type MatchTarget,
  type LexicalContext,
} from '../../src/core/language-match.js';
import { generateLanguage, type GeneratorData } from '../../src/core/generator.js';
import type { AncestorCandidate, AncestorIndex, PhonemeInventory, TypologyIndex } from '../../src/core/data-model.js';

const inventories: PhonemeInventory[] = [
  {
    name: 'German',
    glottocode: 'stan1295',
    iso639_3: 'deu',
    consonants: ['b', 'd', 'd̠ʒ', 'f', 'h', 'j', 'k', 'kʰ', 'l', 'm', 'n', 'p', 'pf', 's', 't', 'ts', 'v', 'x', 'z', 'ç', 'ŋ', 'ɡ', 'ʁ', 'ʃ', 'ʒ'],
    vowels: ['a', 'aɪ', 'aʊ', 'aː', 'e', 'eː', 'iː', 'oː', 'uː', 'y', 'øː', 'œ', 'ə', 'ɛ', 'ɪ', 'ʊ'],
  },
  {
    name: 'Other',
    glottocode: 'othr1234',
    iso639_3: 'oth',
    consonants: ['p', 't', 'k', 'm', 'n', 'l', 'r', 's'],
    vowels: ['a', 'i', 'u'],
  },
];

const typology: TypologyIndex = {
  '81A': {
    featureId: '81A',
    featureName: 'Order of Subject, Object and Verb',
    values: [
      { value: 2, label: 'SVO', count: 5, weight: 0.5 },
      { value: 1, label: 'SOV', count: 5, weight: 0.5 },
    ],
  },
  '87A': {
    featureId: '87A',
    featureName: 'Order of Adjective and Noun',
    values: [{ value: 2, label: 'Adjective-Noun', count: 10, weight: 1 }],
  },
  '49A': {
    featureId: '49A',
    featureName: 'Number of Cases',
    values: [{ value: 4, label: '4 cases', count: 10, weight: 1 }],
  },
  '33A': {
    featureId: '33A',
    featureName: 'Coding of Nominal Plurality',
    values: [{ value: 1, label: 'Plural suffix', count: 10, weight: 1 }],
  },
  '51A': {
    featureId: '51A',
    featureName: 'Position of Case Affixes',
    values: [{ value: 1, label: 'Case suffixes', count: 10, weight: 1 }],
  },
};

const data: MatchData = { inventories, typology };
const fullData: GeneratorData = { inventories, typology, ancestorIndex: {}, coreWords: [] };

const germanTarget: MatchTarget = { name: 'German', consonants: inventories[0].consonants, vowels: inventories[0].vowels };

describe('basePhoneme', () => {
  it('strips length marks, diacritics, and affricate tails to a coarse base', () => {
    expect(basePhoneme('kʰ')).toBe('k');
    expect(basePhoneme('d̠ʒ')).toBe('d');
    expect(basePhoneme('øː')).toBe('ø');
    expect(basePhoneme('aɪ')).toBe('a');
    expect(basePhoneme('ts')).toBe('t');
  });

  it('leaves single-symbol phonemes intact', () => {
    for (const p of ['ʃ', 'θ', 'x', 'ŋ', 's', 'p', 'ø']) expect(basePhoneme(p)).toBe(p);
  });

  it('decomposes precomposed letters to their base (ç -> c)', () => {
    expect(basePhoneme('ç')).toBe('c');
  });
});

describe('baseSet', () => {
  it('collapses variants to a deduplicated base set', () => {
    const set = baseSet(['t', 'tʰ', 'ts', 'kʰ', 'k']);
    expect([...set].sort()).toEqual(['k', 't']);
  });
});

describe('buildProfile', () => {
  it('is deterministic for a seed+style', () => {
    const a = buildProfile('magpie', data, { harshness: 0.5 });
    const b = buildProfile('magpie', data, { harshness: 0.5 });
    expect(a).toEqual(b);
  });

  it('reproduces the same inventory as the full generator', () => {
    const style = { branch: 'German', harshness: 0.7, complexity: 0.4 };
    const profile = buildProfile('magpie', data, style);
    const lang = generateLanguage('magpie', fullData, style);
    const cons = lang.inventory.phonemes.filter((p) => p.type === 'consonant').map((p) => p.ipa);
    const vow = lang.inventory.phonemes.filter((p) => p.type === 'vowel').map((p) => p.ipa);
    expect(profile.consonantsIpa).toEqual(cons);
    expect(profile.vowelsIpa).toEqual(vow);
  });
});

describe('scoreProfile', () => {
  it('produces sub-scores and an overall score within [0,1]', () => {
    const profile = buildProfile('magpie', data, {});
    const m = scoreProfile(profile, germanTarget);
    expect(m.score).toBeGreaterThanOrEqual(0);
    expect(m.score).toBeLessThanOrEqual(1);
    expect(m.phonemeScore).toBeGreaterThanOrEqual(0);
    expect(m.phonemeScore).toBeLessThanOrEqual(1);
  });

  it('gives a typology score for targets with a reference profile, null otherwise', () => {
    const profile = buildProfile('magpie', data, {});
    expect(scoreProfile(profile, germanTarget).typologyScore).not.toBeNull();
    const noRef: MatchTarget = { name: 'Icelandic', consonants: ['p', 't', 'k'], vowels: ['a', 'i', 'u'] };
    expect(scoreProfile(profile, noRef).typologyScore).toBeNull();
  });

  it('scores a well-matched target higher than a disjoint one', () => {
    const profile = buildProfile('magpie', data, {});
    const near: MatchTarget = {
      name: 'Near',
      consonants: profile.consonantsIpa,
      vowels: profile.vowelsIpa,
    };
    const far: MatchTarget = { name: 'Far', consonants: ['q', 'ʕ', 'ɓ'], vowels: ['ɯ', 'ɤ'] };
    expect(scoreProfile(profile, near).phonemeScore).toBeGreaterThan(scoreProfile(profile, far).phonemeScore);
  });
});

describe('makeCandidateSeeds', () => {
  it('is deterministic and returns the requested count of distinct seeds', () => {
    const a = makeCandidateSeeds(50);
    const b = makeCandidateSeeds(50);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(50);
  });
});

describe('findClosestSeeds', () => {
  it('returns distinct seeds sorted by descending score, all within [0,1]', () => {
    const matches = findClosestSeeds(germanTarget, data, { seedCount: 40, topK: 5 });
    expect(matches.length).toBe(5);
    expect(new Set(matches.map((m) => m.seed)).size).toBe(5);
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score);
    }
    for (const m of matches) {
      expect(m.score).toBeGreaterThanOrEqual(0);
      expect(m.score).toBeLessThanOrEqual(1);
    }
  });

  it('is fully deterministic', () => {
    const a = findClosestSeeds(germanTarget, data, { seedCount: 40, topK: 5 });
    const b = findClosestSeeds(germanTarget, data, { seedCount: 40, topK: 5 });
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('the best match reproduces its reported inventory when regenerated', () => {
    const [best] = findClosestSeeds(germanTarget, data, { seedCount: 40, topK: 1 });
    const profile = buildProfile(best.seed, data, best.style);
    const rescored = scoreProfile(profile, germanTarget);
    expect(rescored.score).toBe(best.score);
  });
});

function cand(form: string): AncestorCandidate {
  return { form, lang: 'proto-indo-european', relationshipType: 'inherited', confidence: 0.9, depth: 6, hops: 1, score: 14 };
}

// Deep (PIE-ish) roots and real modern German reflexes for a handful of concepts.
const ancestorIndex: AncestorIndex = {
  water: { best: cand('*wódr̥'), alternates: [] },
  mother: { best: cand('*méh₂tēr'), alternates: [] },
  father: { best: cand('*ph₂tḗr'), alternates: [] },
  three: { best: cand('*tréyes'), alternates: [] },
  new: { best: cand('*néwos'), alternates: [] },
  name: { best: cand('*h₁nómn̥'), alternates: [] },
  night: { best: cand('*nókʷts'), alternates: [] },
  hand: { best: cand('*ǵʰes-r'), alternates: [] },
  sun: { best: cand('*sóh₂wl̥'), alternates: [] },
  heart: { best: cand('*ḱḗr'), alternates: [] },
};
const germanReflexes: Record<string, string> = {
  water: 'Wasser', mother: 'Mutter', father: 'Vater', three: 'drei', new: 'neu',
  name: 'Name', night: 'Nacht', hand: 'Hand', sun: 'Sonne', heart: 'Herz',
};
const lexCtx: LexicalContext = { ancestorIndex, reflexes: germanReflexes };

describe('formSimilarity', () => {
  it('is 1 for identical forms after normalization and lower for divergent ones', () => {
    expect(formSimilarity('mutter', 'Mutter')).toBe(1);
    expect(formSimilarity('meter', 'Mutter')).toBeGreaterThan(0);
    expect(formSimilarity('meter', 'Mutter')).toBeLessThan(1);
    expect(formSimilarity('xyz', 'Wasser')).toBeLessThan(0.3);
  });
});

describe('computeLexical', () => {
  it('scores PIE-derived output against real reflexes, returning sorted examples', () => {
    const profile = buildProfile('magpie', data, {});
    const res = computeLexical(profile, lexCtx);
    expect(res).not.toBeNull();
    expect(res!.coverage).toBe(10);
    expect(res!.score).toBeGreaterThanOrEqual(0);
    expect(res!.score).toBeLessThanOrEqual(1);
    for (let i = 1; i < res!.examples.length; i++) {
      expect(res!.examples[i - 1].similarity).toBeGreaterThanOrEqual(res!.examples[i].similarity);
    }
  });

  it('skips non-Latin reflexes and returns null when Latin coverage is too low', () => {
    const cyrillic: Record<string, string> = { water: 'вода', mother: 'мать', three: 'три' };
    const res = computeLexical(buildProfile('magpie', data, {}), { ancestorIndex, reflexes: cyrillic });
    expect(res).toBeNull();
  });
});

describe('waypoint scoring', () => {
  it('waypointLangsFor returns branch stages for known targets, empty otherwise', () => {
    expect(waypointLangsFor('German')).toContain('proto-germanic');
    expect(waypointLangsFor('French')).toContain('latin');
    expect(waypointLangsFor('Klingon')).toEqual([]);
  });

  it('rewards trajectories that pass through a real intermediate form', () => {
    // Each entry gets a proto-germanic alternate identical to its PIE base, so the
    // base (always the first trajectory state) matches the waypoint exactly.
    const withWaypoints: AncestorIndex = {};
    for (const [concept, entry] of Object.entries(ancestorIndex)) {
      withWaypoints[concept] = {
        best: entry.best,
        alternates: [{ ...entry.best, lang: 'proto-germanic' }],
      };
    }
    const profile = buildProfile('magpie', data, {});
    const without = computeLexical(profile, { ancestorIndex: withWaypoints, reflexes: germanReflexes });
    const withWp = computeLexical(profile, {
      ancestorIndex: withWaypoints,
      reflexes: germanReflexes,
      waypointLangs: ['proto-germanic'],
    });
    expect(without).not.toBeNull();
    expect(withWp).not.toBeNull();
    expect(withWp!.coverage).toBe(without!.coverage);
    // A perfectly-matched waypoint can only raise each concept's blended score.
    expect(withWp!.score).toBeGreaterThan(without!.score);
    expect(withWp!.score).toBeLessThanOrEqual(1);
  });
});

describe('findClosestSeeds with reflex data', () => {
  const lexData: MatchData = { ...data, ancestorIndex, reflexes: { German: germanReflexes } };

  it('reports a lexical score and word examples, and ranks by overall score', () => {
    const matches = findClosestSeeds(germanTarget, lexData, { seedCount: 40, topK: 3 });
    expect(matches[0].lexicalScore).not.toBeNull();
    expect(matches[0].lexicalCoverage).toBe(10);
    expect(matches[0].examples.length).toBeGreaterThan(0);
    expect(matches[0].examples[0]).toHaveProperty('ours');
    expect(matches[0].examples[0]).toHaveProperty('real');
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score);
    }
  });

  it('leaves lexicalScore null when the target has no reflex entry', () => {
    const noRef: MatchTarget = { name: 'Other', consonants: ['p', 't', 'k'], vowels: ['a', 'i', 'u'] };
    const matches = findClosestSeeds(noRef, lexData, { seedCount: 30, topK: 1 });
    expect(matches[0].lexicalScore).toBeNull();
  });

  it('is fully deterministic', () => {
    const a = findClosestSeeds(germanTarget, lexData, { seedCount: 30, topK: 3 });
    const b = findClosestSeeds(germanTarget, lexData, { seedCount: 30, topK: 3 });
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });
});
