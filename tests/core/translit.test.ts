import { describe, it, expect } from 'vitest';
import { transliterate } from '../../src/core/translit.js';

describe('transliterate', () => {
  it('leaves Latin-script forms unchanged', () => {
    expect(transliterate('Wasser')).toBe('Wasser');
    expect(transliterate('quatre')).toBe('quatre');
    expect(transliterate('köttur')).toBe('köttur');
  });

  it('romanizes Cyrillic (Russian)', () => {
    expect(transliterate('вода')).toBe('voda'); // water
    expect(transliterate('семь')).toBe('sem'); // seven (soft sign dropped)
    expect(transliterate('волк')).toBe('volk'); // wolf
    expect(transliterate('два')).toBe('dva'); // two
  });

  it('romanizes Greek, including rough-breathing /h/', () => {
    expect(transliterate('γάτα')).toBe('gata'); // cat
    expect(transliterate('λύκος')).toBe('lykos'); // wolf
    expect(transliterate('ἑπτά')).toBe('hepta'); // seven (rough breathing → h)
  });

  it('romanizes Devanagari (Sanskrit) with inherent vowels, matras, and virama', () => {
    expect(transliterate('नामन्')).toBe('naman'); // name (final virama → no vowel)
    expect(transliterate('सप्तन्')).toBe('saptan'); // seven
    expect(transliterate('तारा')).toBe('tara'); // star (matra ā)
  });

  it('produces Latin-only output that survives downstream a-z normalization', () => {
    expect(transliterate('приятель')).toMatch(/^[a-z]+$/);
  });
});
