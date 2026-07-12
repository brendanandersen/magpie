import { describe, it, expect } from 'vitest';
import { Rng } from '../../src/core/rng.js';
import { resolveStyle } from '../../src/core/language.js';
import { buildInventory } from '../../src/core/phonology.js';
import { buildSoundChanges } from '../../src/core/sound-change.js';
import { generateLanguage, type GeneratorData } from '../../src/core/generator.js';
import type { AncestorIndex, PhonemeInventory, TypologyIndex } from '../../src/core/data-model.js';

const greek: PhonemeInventory = {
  name: 'Greek',
  glottocode: 'g',
  iso639_3: 'ell',
  consonants: ['p', 't', 'k', 's', 'm', 'n', 'l', 'r'],
  vowels: ['a', 'e', 'i', 'o', 'u'],
};
const sanskrit: PhonemeInventory = {
  name: 'Sanskrit',
  glottocode: 's',
  iso639_3: 'san',
  consonants: ['p', 't', 'k', 'b', 'd', 'g', 's', 'm', 'n', 'l', 'r'],
  vowels: ['a', 'i', 'u'],
};

const typology: TypologyIndex = {
  '81A': { featureId: '81A', featureName: 'wo', values: [{ value: 2, label: 'SVO', count: 1, weight: 1 }] },
  '87A': { featureId: '87A', featureName: 'an', values: [{ value: 2, label: 'Noun-Adjective', count: 1, weight: 1 }] },
  '49A': { featureId: '49A', featureName: 'nc', values: [{ value: 1, label: 'No morphological case', count: 1, weight: 1 }] },
  '33A': { featureId: '33A', featureName: 'np', values: [{ value: 1, label: 'Plural suffix', count: 1, weight: 1 }] },
  '51A': { featureId: '51A', featureName: 'ca', values: [{ value: 1, label: 'Case suffixes', count: 1, weight: 1 }] },
};

const ancestorIndex: AncestorIndex = {
  mother: { best: { form: '*méh₂tēr', lang: 'proto-indo-european', relationshipType: 'inherited', confidence: 0.92, depth: 6, hops: 1, score: 14 }, alternates: [] },
};
const data: GeneratorData = { inventories: [greek, sanskrit], typology, ancestorIndex, coreWords: ['mother'] };

const HARSH = ['th', 'kh', 'gh', 'sh', 'dh'];
const APOCOPE = ['apocope_e', 'apocope_a'];

describe('style: determinism', () => {
  it('same seed + options => identical language', () => {
    const opts = { branch: 'Greek', harshness: 0.8, wordLength: 'short' as const, complexity: 0.7 };
    expect(JSON.stringify(generateLanguage('x', data, opts))).toEqual(
      JSON.stringify(generateLanguage('x', data, opts)),
    );
  });
});

describe('style: branch bias', () => {
  it('uses the requested source inventory', () => {
    expect(generateLanguage('x', data, { branch: 'Greek' }).inventory.inspiredBy).toBe('Greek');
    expect(generateLanguage('x', data, { branch: 'Sanskrit' }).inventory.inspiredBy).toBe('Sanskrit');
  });
});

describe('style: harshness', () => {
  it('high harshness guarantees a harsh consonant; low favors sonorants', () => {
    const harsh = buildInventory(new Rng('inv'), sanskrit, resolveStyle({ harshness: 1 }));
    const soft = buildInventory(new Rng('inv'), sanskrit, resolveStyle({ harshness: 0 }));
    expect(harsh.consonants.some((c) => HARSH.includes(c))).toBe(true);
    const harshCount = harsh.consonants.filter((c) => HARSH.includes(c)).length;
    const softCount = soft.consonants.filter((c) => HARSH.includes(c)).length;
    expect(harshCount).toBeGreaterThanOrEqual(softCount);
  });
});

describe('style: complexity', () => {
  it('higher complexity yields at least as many sound-change rules', () => {
    const high = buildSoundChanges(new Rng('r'), resolveStyle({ complexity: 1 }));
    const low = buildSoundChanges(new Rng('r'), resolveStyle({ complexity: 0 }));
    expect(high.length).toBeGreaterThan(low.length);
  });

  it('higher complexity allows consonant clusters (onsetMax 2)', () => {
    expect(generateLanguage('x', data, { complexity: 1 }).phonotactics.onsetMax).toBe(2);
    expect(generateLanguage('x', data, { complexity: 0 }).phonotactics.onsetMax).toBe(1);
  });
});

describe('style: wordLength', () => {
  it('short forces apocope rules; long excludes them', () => {
    const short = buildSoundChanges(new Rng('r'), resolveStyle({ wordLength: 'short' }));
    const long = buildSoundChanges(new Rng('r'), resolveStyle({ wordLength: 'long' }));
    expect(short.some((r) => APOCOPE.includes(r.id))).toBe(true);
    expect(long.some((r) => APOCOPE.includes(r.id))).toBe(false);
  });
});
