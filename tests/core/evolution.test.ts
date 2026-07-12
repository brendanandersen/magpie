import { describe, it, expect } from 'vitest';
import { buildEvolvedSoundChanges } from '../../src/core/sound-change.js';
import { resolveStyle, MAX_GENERATIONS } from '../../src/core/language.js';
import { generateLanguage, type GeneratorData } from '../../src/core/generator.js';
import type { AncestorIndex, PhonemeInventory, TypologyIndex } from '../../src/core/data-model.js';

const inventories: PhonemeInventory[] = [
  {
    name: 'TestSource',
    glottocode: 't',
    iso639_3: 'tst',
    consonants: ['p', 't', 'k', 'b', 'd', 'g', 's', 'm', 'n', 'l', 'r'],
    vowels: ['a', 'e', 'i', 'o', 'u'],
  },
];
const typology: TypologyIndex = {
  '81A': { featureId: '81A', featureName: 'wo', values: [{ value: 2, label: 'SVO', count: 1, weight: 1 }] },
  '87A': { featureId: '87A', featureName: 'an', values: [{ value: 2, label: 'Noun-Adjective', count: 1, weight: 1 }] },
  '49A': { featureId: '49A', featureName: 'nc', values: [{ value: 1, label: 'No morphological case', count: 1, weight: 1 }] },
  '33A': { featureId: '33A', featureName: 'np', values: [{ value: 1, label: 'Plural suffix', count: 1, weight: 1 }] },
  '51A': { featureId: '51A', featureName: 'ca', values: [{ value: 1, label: 'Case suffixes', count: 1, weight: 1 }] },
};
const ancestorIndex: AncestorIndex = {
  the: { best: { form: '*só', lang: 'proto-indo-european', relationshipType: 'inherited', confidence: 0.9, depth: 6, hops: 1, score: 13 }, alternates: [] },
  mother: { best: { form: '*méh₂tēr', lang: 'proto-indo-european', relationshipType: 'inherited', confidence: 0.92, depth: 6, hops: 1, score: 14 }, alternates: [] },
};
const data: GeneratorData = { inventories, typology, ancestorIndex, coreWords: ['the', 'mother'] };

describe('buildEvolvedSoundChanges', () => {
  it('is deterministic for a seed + style', () => {
    const s = resolveStyle({ generations: 4 });
    expect(buildEvolvedSoundChanges('x', s)).toEqual(buildEvolvedSoundChanges('x', s));
  });

  it('tags rules with their generation and covers all generations', () => {
    const rules = buildEvolvedSoundChanges('x', resolveStyle({ generations: 4 }));
    const gens = new Set(rules.map((r) => r.generation));
    expect(gens).toEqual(new Set([1, 2, 3, 4]));
  });

  it('more generations yield more rules', () => {
    const few = buildEvolvedSoundChanges('x', resolveStyle({ generations: 2 }));
    const many = buildEvolvedSoundChanges('x', resolveStyle({ generations: 8 }));
    expect(many.length).toBeGreaterThan(few.length);
  });

  it('supports generations beyond the former cap of 8', () => {
    const s = resolveStyle({ generations: 12 });
    expect(s.generations).toBe(12);
    const gens = new Set(buildEvolvedSoundChanges('x', s).map((r) => r.generation));
    expect(gens).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
  });

  it('clamps generations to the safety ceiling', () => {
    expect(resolveStyle({ generations: 100000 }).generations).toBe(MAX_GENERATIONS);
  });
});

describe('cross-seed variety (regression for "the → su/so" clustering)', () => {
  it('produces many distinct forms for a short function word across seeds', () => {
    const seeds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p'];
    const forms = new Set(
      seeds.map((seed) => generateLanguage(seed, data).lexicon.find((w) => w.english === 'the')!.roman),
    );
    // Old single-pass system produced essentially {so, su}. Evolution should do far better.
    expect(forms.size).toBeGreaterThanOrEqual(6);
  });
});
