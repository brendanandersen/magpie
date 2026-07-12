import { describe, it, expect } from 'vitest';
import { generateLanguage, type GeneratorData } from '../../src/core/generator.js';
import type { AncestorIndex, PhonemeInventory, TypologyIndex } from '../../src/core/data-model.js';

const inventories: PhonemeInventory[] = [
  {
    name: 'TestSource',
    glottocode: 'test1234',
    iso639_3: 'tst',
    consonants: ['p', 't', 'k', 'b', 'd', 'g', 's', 'm', 'n', 'l', 'r'],
    vowels: ['a', 'e', 'i', 'o', 'u'],
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
    values: [{ value: 2, label: 'Noun-Adjective', count: 10, weight: 1 }],
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

const ancestorIndex: AncestorIndex = {
  mother: {
    best: { form: '*méh₂tēr', lang: 'proto-indo-european', relationshipType: 'inherited', confidence: 0.92, depth: 6, hops: 1, score: 14 },
    alternates: [],
  },
  water: {
    best: { form: '*wódr̥', lang: 'proto-indo-european', relationshipType: 'derived', confidence: 0.95, depth: 6, hops: 1, score: 14 },
    alternates: [],
  },
};

const data: GeneratorData = { inventories, typology, ancestorIndex, coreWords: ['mother', 'water', 'zzz'] };

describe('generateLanguage', () => {
  it('is fully deterministic for a given seed', () => {
    const a = generateLanguage('magpie', data);
    const b = generateLanguage('magpie', data);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('produces different languages for different seeds', () => {
    const a = generateLanguage('alpha', data);
    const b = generateLanguage('beta', data);
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });

  it('produces a complete definition', () => {
    const lang = generateLanguage('magpie', data);
    expect(lang.name.length).toBeGreaterThan(0);
    expect(lang.inventory.consonants.length).toBeGreaterThan(0);
    expect(lang.inventory.vowels.length).toBeGreaterThan(0);
    expect(lang.soundChangeRules.length).toBeGreaterThanOrEqual(5);
    expect(lang.grammar.wordOrder).toMatch(/^(SOV|SVO|VSO|VOS|OVS|OSV)$/);
  });

  it('derives traced words and coins the rest, always within the inventory', () => {
    const lang = generateLanguage('magpie', data);
    const invSegments = new Set([...lang.inventory.consonants, ...lang.inventory.vowels]);
    const seg = new RegExp(`${['th', 'kh', 'gh', 'sh', 'dh', 'bh', 'ph', 'kw', 'gw'].join('|')}|[a-z]`, 'g');

    const mother = lang.lexicon.find((w) => w.english === 'mother')!;
    const coined = lang.lexicon.find((w) => w.english === 'zzz')!;
    expect(mother.origin).toBe('traced');
    expect(coined.origin).toBe('coined');
    expect(mother.roman.length).toBeGreaterThan(0);

    for (const word of lang.lexicon) {
      for (const s of word.roman.match(seg) ?? []) {
        expect(invSegments.has(s)).toBe(true);
      }
    }
  });
});
