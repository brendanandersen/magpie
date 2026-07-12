import { describe, it, expect } from 'vitest';
import { applyOverrides, hasOverrides } from '../../src/core/overrides.js';
import { generateLanguage, type GeneratorData } from '../../src/core/generator.js';
import type { AncestorIndex, PhonemeInventory, TypologyIndex } from '../../src/core/data-model.js';

const inventories: PhonemeInventory[] = [
  {
    name: 'TestSource',
    glottocode: 't',
    iso639_3: 'tst',
    consonants: ['p', 't', 'k', 's', 'm', 'n', 'l', 'r'],
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
};
const data: GeneratorData = { inventories, typology, ancestorIndex, coreWords: ['mother', 'water'] };
const lang = generateLanguage('magpie', data);

describe('hasOverrides', () => {
  it('detects presence of overrides', () => {
    expect(hasOverrides(undefined)).toBe(false);
    expect(hasOverrides({})).toBe(false);
    expect(hasOverrides({ consonants: ['t'] })).toBe(true);
  });
});

describe('applyOverrides', () => {
  it('is deterministic and preserves seed/name/grammar', () => {
    const o = { soundChangeRules: lang.soundChangeRules.slice(0, 2) };
    const a = applyOverrides(lang, o);
    const b = applyOverrides(lang, o);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    expect(a.seed).toBe(lang.seed);
    expect(a.name).toBe(lang.name);
    expect(a.grammar).toEqual(lang.grammar);
  });

  it('re-derives the lexicon when rules change', () => {
    const noRules = applyOverrides(lang, { soundChangeRules: [] });
    // With no sound changes, derived words differ from the rule-applied originals
    // (unless a word happened to be unaffected); at least one should differ.
    const changed = noRules.lexicon.some((w, i) => w.roman !== lang.lexicon[i].roman);
    expect(changed).toBe(true);
  });

  it('confines words to an edited inventory (removed consonant never appears)', () => {
    const consonants = ['t', 'k', 'm', 'n']; // drop s, l, r, etc.
    const edited = applyOverrides(lang, { consonants });
    expect(edited.inventory.consonants).toEqual(consonants);
    const seg = new RegExp(`${['th', 'kh', 'gh', 'sh', 'dh', 'bh', 'ph', 'kw', 'gw'].join('|')}|[a-z]`, 'g');
    const allowed = new Set([...consonants, ...edited.inventory.vowels]);
    for (const w of edited.lexicon) {
      for (const s of w.roman.match(seg) ?? []) expect(allowed.has(s)).toBe(true);
    }
  });
});
