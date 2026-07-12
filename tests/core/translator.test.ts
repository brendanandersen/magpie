import { describe, it, expect } from 'vitest';
import { tokenize, lemmatize, translate } from '../../src/core/translator.js';
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
    values: [{ value: 1, label: 'SOV', count: 10, weight: 1 }],
  },
  '87A': {
    featureId: '87A',
    featureName: 'Order of Adjective and Noun',
    values: [{ value: 2, label: 'Noun-Adjective', count: 10, weight: 1 }],
  },
  '49A': {
    featureId: '49A',
    featureName: 'Number of Cases',
    values: [{ value: 1, label: 'No morphological case', count: 10, weight: 1 }],
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

const data: GeneratorData = { inventories, typology, ancestorIndex, coreWords: ['mother', 'water'] };
const lang = generateLanguage('magpie', data);

describe('tokenize', () => {
  it('separates words from punctuation and roundtrips', () => {
    const toks = tokenize('The mother, water!');
    expect(toks.map((t) => t.text).join('')).toBe('The mother, water!');
    expect(toks.filter((t) => t.isWord).map((t) => t.text)).toEqual(['The', 'mother', 'water']);
  });
});

describe('lemmatize', () => {
  it('returns the word directly when present', () => {
    expect(lemmatize('water', ancestorIndex)).toEqual({ lemma: 'water', plural: false });
  });

  it('detects regular plurals', () => {
    expect(lemmatize('mothers', ancestorIndex)).toEqual({
      lemma: 'mother',
      plural: true,
      reducedFrom: 'mothers',
    });
  });

  it('falls back to the lowercased surface when unknown', () => {
    expect(lemmatize('Zqx', ancestorIndex)).toEqual({ lemma: 'zqx', plural: false });
  });
});

describe('translate', () => {
  it('is deterministic', () => {
    const a = translate('The mother drinks water.', lang, ancestorIndex);
    const b = translate('The mother drinks water.', lang, ancestorIndex);
    expect(a).toEqual(b);
  });

  it('traces known words and coins unknown ones', () => {
    const res = translate('mother xyzzy', lang, ancestorIndex);
    const words = res.tokens.filter((t) => t.isWord);
    expect(words[0].origin).toBe('traced');
    expect(words[0].ancestorLang).toBe('proto-indo-european');
    expect(words[1].origin).toBe('coined');
  });

  it('applies the plural affix to detected plurals', () => {
    const singular = translate('mother', lang, ancestorIndex).tokens.find((t) => t.isWord)!;
    const plural = translate('mothers', lang, ancestorIndex).tokens.find((t) => t.isWord)!;
    expect(plural.roman.length).toBeGreaterThan(singular.roman.length);
    expect(plural.roman.endsWith(lang.grammar.pluralAffix)).toBe(true);
    expect(plural.notes.some((n) => n.startsWith('plural'))).toBe(true);
  });

  it('preserves punctuation and spacing in output', () => {
    const res = translate('mother, water!', lang, ancestorIndex);
    expect(res.output).toMatch(/^[a-z]+, [a-z]+!$/);
  });

  it('exposes the language word order', () => {
    const res = translate('mother', lang, ancestorIndex);
    expect(res.wordOrder).toBe('SOV');
  });
});
