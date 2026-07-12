import { describe, it, expect } from 'vitest';
import { compareLanguageDNA, grammarToVector } from '../../src/core/language-dna.js';
import type { GrammarParams } from '../../src/core/language.js';

const englishLike: GrammarParams = {
  wordOrder: 'SVO',
  wordOrderSource: 'SVO',
  adjNounOrder: 'adjective-noun',
  pluralAffix: 's',
  pluralAffixType: 'suffix',
  cases: [],
  caseAffixPosition: 'suffix',
};

const latinLike: GrammarParams = {
  wordOrder: 'SOV',
  wordOrderSource: 'SOV',
  adjNounOrder: 'adjective-noun',
  pluralAffix: 'i',
  pluralAffixType: 'suffix',
  cases: [
    { name: 'nominative', affix: 'us' },
    { name: 'accusative', affix: 'um' },
    { name: 'genitive', affix: 'i' },
    { name: 'dative', affix: 'o' },
  ],
  caseAffixPosition: 'suffix',
};

describe('grammarToVector', () => {
  it('sets caseAffixPosition to none when there are no cases', () => {
    expect(grammarToVector(englishLike).caseAffixPosition).toBe('none');
    expect(grammarToVector(latinLike).caseAffixPosition).toBe('suffix');
  });
});

describe('compareLanguageDNA', () => {
  it('ranks the closest real language first and is sorted descending', () => {
    const matches = compareLanguageDNA(englishLike);
    expect(matches[0].name).toBe('English');
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].similarity).toBeGreaterThanOrEqual(matches[i].similarity);
    }
  });

  it('an exact English profile scores 1.0 similarity', () => {
    const english = compareLanguageDNA(englishLike).find((m) => m.name === 'English')!;
    expect(english.similarity).toBe(1);
    expect(english.shared).toContain('word order (SVO)');
  });

  it('a case-heavy SOV grammar favors case languages over English', () => {
    const matches = compareLanguageDNA(latinLike);
    const english = matches.find((m) => m.name === 'English')!;
    const latin = matches.find((m) => m.name === 'Latin')!;
    expect(latin.similarity).toBeGreaterThan(english.similarity);
  });
});
