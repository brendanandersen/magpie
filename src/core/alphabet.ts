/**
 * Shared romanized phoneme alphabet used across the generator. Word derivation
 * operates on this clean ASCII-ish alphabet (single letters plus a few digraphs);
 * IPA is rendered from it for display. This keeps sound-change and inventory logic
 * self-consistent regardless of the messy source-form notation (PIE reconstructions).
 */

export const VOWEL_CHARS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);

/** Multi-character segments recognized as single units. */
export const DIGRAPHS = ['th', 'kh', 'gh', 'sh', 'dh', 'bh', 'ph', 'kw', 'gw'] as const;

/** Greedy segment matcher: digraphs first, then single letters. */
export const SEG_REGEX = new RegExp(`${DIGRAPHS.join('|')}|[a-z]`, 'g');

/** Roman -> IPA rendering table for display. */
export const IPA_MAP: Record<string, string> = {
  p: 'p', t: 't', k: 'k', b: 'b', d: 'd', g: 'ɡ',
  f: 'f', v: 'v', s: 's', z: 'z', h: 'h',
  m: 'm', n: 'n', l: 'l', r: 'r', w: 'w', j: 'j',
  th: 'θ', dh: 'ð', kh: 'x', gh: 'ɣ', sh: 'ʃ', ph: 'f',
  kw: 'kʷ', gw: 'ɡʷ',
  a: 'a', e: 'ɛ', i: 'i', o: 'ɔ', u: 'u', y: 'y',
};

/** Consonants that every generated inventory is guaranteed to contain. */
export const GUARANTEED_CONSONANTS = ['t', 'k', 's', 'm', 'n', 'l', 'r'];
/** Vowels that every generated inventory is guaranteed to contain. */
export const GUARANTEED_VOWELS = ['a', 'i', 'u'];

/** Optional consonants an inventory may sample in addition to the guaranteed set. */
export const OPTIONAL_CONSONANTS = [
  'p', 'b', 'd', 'g', 'f', 'v', 'z', 'h', 'w', 'j', 'th', 'kh', 'gh', 'sh', 'dh',
];
/** Optional vowels an inventory may sample. */
export const OPTIONAL_VOWELS = ['e', 'o', 'y'];

export function isVowelSegment(seg: string): boolean {
  return seg.length === 1 && VOWEL_CHARS.has(seg);
}

/** Split a romanized word into ordered segments (digraphs kept whole). */
export function tokenize(word: string): string[] {
  return word.match(SEG_REGEX) ?? [];
}

/** Render a romanized word as an IPA string. */
export function toIpa(word: string): string {
  return tokenize(word)
    .map((seg) => IPA_MAP[seg] ?? seg)
    .join('');
}
