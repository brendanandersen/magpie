import { describe, it, expect } from 'vitest';
import { encodeOverrides, decodeOverrides } from '../../web/src/storage';
import type { LanguageOverrides } from '../../src/shared/types';

const sampleOverrides: LanguageOverrides = {
  soundChangeRules: [
    { id: 'anchor_German_early_0_bh_b_any', description: '[German] bh → b', from: 'bh', to: 'b', env: 'any', law: 'Deaspiration of the PIE breathy-voiced series' },
    { id: 'anchor_German_early_1_d_t_any', description: '[German] d → t', from: 'd', to: 't', env: 'any', law: "Grimm's law (voiced-stop devoicing)" },
    { id: 'gen1_0_o_a_any', description: '[gen 1] o → a', from: 'o', to: 'a', env: 'any', generation: 1, law: 'Vowel shift' },
    { id: 'gen1_1_t_s_intervocalic', description: '[gen 1] t → s /intervocalic', from: 't', to: 's', env: 'intervocalic', generation: 1, law: 'Spirantization (lenition)' },
    { id: 'gen2_0_a_e_before_front', description: '[gen 2] a → e /before front', from: 'a', to: 'e', env: 'before_front', generation: 2, law: 'Umlaut (fronting before a front vowel)' },
  ],
  consonants: ['p', 't', 'k', 'b', 'd', 'g', 's', 'm', 'n', 'r', 'l'],
  vowels: ['a', 'e', 'i', 'o', 'u'],
};

describe('encodeOverrides / decodeOverrides', () => {
  it('round-trips overrides exactly', () => {
    const token = encodeOverrides(sampleOverrides);
    expect(decodeOverrides(token)).toEqual(sampleOverrides);
  });

  it('produces a compact, URL-safe, non-JSON token', () => {
    const token = encodeOverrides(sampleOverrides);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/); // base64url, no padding/reserved chars
    expect(token.length).toBeLessThan(JSON.stringify(sampleOverrides).length);
  });

  it('still decodes legacy raw-JSON tokens', () => {
    expect(decodeOverrides(JSON.stringify(sampleOverrides))).toEqual(sampleOverrides);
  });

  it('returns undefined for empty overrides and invalid tokens', () => {
    expect(decodeOverrides(encodeOverrides({}))).toBeUndefined();
    expect(decodeOverrides('not a valid token !!!')).toBeUndefined();
    expect(decodeOverrides('')).toBeUndefined();
  });
});
