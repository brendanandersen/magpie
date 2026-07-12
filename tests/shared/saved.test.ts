import { describe, it, expect } from 'vitest';
import {
  upsertEntry,
  removeFromList,
  normalizeSavedList,
  MAX_SAVED,
  type SavedLanguage,
} from '../../src/shared/saved.js';

const entry = (seed: string, savedAt = 1): SavedLanguage => ({ seed, name: `Lang-${seed}`, savedAt });

describe('upsertEntry', () => {
  it('prepends a new entry', () => {
    const list = upsertEntry([entry('a')], entry('b', 2));
    expect(list.map((e) => e.seed)).toEqual(['b', 'a']);
  });

  it('replaces an existing entry by seed and moves it to front', () => {
    const list = upsertEntry([entry('a'), entry('b')], { seed: 'a', name: 'New', savedAt: 5 });
    expect(list.map((e) => e.seed)).toEqual(['a', 'b']);
    expect(list[0].name).toBe('New');
    expect(list).toHaveLength(2);
  });

  it('caps the list at MAX_SAVED', () => {
    let list: SavedLanguage[] = [];
    for (let i = 0; i < MAX_SAVED + 10; i++) list = upsertEntry(list, entry(`s${i}`, i));
    expect(list).toHaveLength(MAX_SAVED);
  });
});

describe('removeFromList', () => {
  it('removes by seed', () => {
    expect(removeFromList([entry('a'), entry('b')], 'a').map((e) => e.seed)).toEqual(['b']);
  });
});

describe('normalizeSavedList', () => {
  it('filters invalid entries and dedupes by seed', () => {
    const parsed = [
      { seed: 'a', name: 'A', savedAt: 1 },
      { seed: 'a', name: 'dup' },
      { notSeed: true },
      'garbage',
      { seed: 'b' },
    ];
    const list = normalizeSavedList(parsed);
    expect(list.map((e) => e.seed)).toEqual(['a', 'b']);
    expect(list[1].name).toBe('b'); // falls back to seed
  });

  it('returns [] for non-arrays', () => {
    expect(normalizeSavedList(null)).toEqual([]);
    expect(normalizeSavedList({})).toEqual([]);
  });
});
