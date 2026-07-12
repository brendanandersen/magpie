import { describe, it, expect } from 'vitest';
import { levenshtein, buildReverseIndex, reverseTranslate } from '../../src/core/reverse.js';
import { generateLanguage, type GeneratorData } from '../../src/core/generator.js';
import { translate } from '../../src/core/translator.js';
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
  '81A': { featureId: '81A', featureName: 'wo', values: [{ value: 2, label: 'SVO', count: 1, weight: 1 }] },
  '87A': { featureId: '87A', featureName: 'an', values: [{ value: 2, label: 'Noun-Adjective', count: 1, weight: 1 }] },
  '49A': { featureId: '49A', featureName: 'nc', values: [{ value: 1, label: 'No morphological case', count: 1, weight: 1 }] },
  '33A': { featureId: '33A', featureName: 'np', values: [{ value: 1, label: 'Plural suffix', count: 1, weight: 1 }] },
  '51A': { featureId: '51A', featureName: 'ca', values: [{ value: 1, label: 'Case suffixes', count: 1, weight: 1 }] },
};

const ancestorIndex: AncestorIndex = {
  mother: { best: { form: '*méh₂tēr', lang: 'proto-indo-european', relationshipType: 'inherited', confidence: 0.92, depth: 6, hops: 1, score: 14 }, alternates: [] },
  water: { best: { form: '*wódr̥', lang: 'proto-indo-european', relationshipType: 'derived', confidence: 0.95, depth: 6, hops: 1, score: 14 }, alternates: [] },
  brother: { best: { form: '*bʰréh₂tēr', lang: 'proto-indo-european', relationshipType: 'inherited', confidence: 0.92, depth: 6, hops: 1, score: 14 }, alternates: [] },
};

const data: GeneratorData = { inventories, typology, ancestorIndex, coreWords: ['mother', 'water', 'brother'] };
const lang = generateLanguage('magpie', data);

describe('levenshtein', () => {
  it('computes edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('abc', 'abc')).toBe(0);
    expect(levenshtein('', 'abc')).toBe(3);
  });
});

describe('buildReverseIndex', () => {
  it('maps roman forms back to english', () => {
    const idx = buildReverseIndex(lang.lexicon);
    const mother = lang.lexicon.find((w) => w.english === 'mother')!;
    expect(idx.get(mother.roman)).toBe('mother');
  });
});

describe('reverseTranslate', () => {
  it('round-trips a forward translation back to the source words', () => {
    const forward = translate('mother water', lang, ancestorIndex);
    const back = reverseTranslate(forward.output, lang);
    expect(back.output).toBe('mother water');
  });

  it('recovers plural marking', () => {
    const forward = translate('brothers', lang, ancestorIndex);
    const back = reverseTranslate(forward.output, lang);
    const word = back.tokens.find((t) => t.isWord)!;
    expect(word.plural).toBe(true);
    expect(word.english).toBe('brothers');
  });

  it('marks unrecognized words as unknown', () => {
    const back = reverseTranslate('zzzxq', lang);
    const word = back.tokens.find((t) => t.isWord)!;
    expect(word.notes).toContain('unknown word');
  });

  it('preserves punctuation and spacing', () => {
    const forward = translate('mother, water!', lang, ancestorIndex);
    const back = reverseTranslate(forward.output, lang);
    expect(back.output).toMatch(/, /);
    expect(back.output.endsWith('!')).toBe(true);
  });
});
