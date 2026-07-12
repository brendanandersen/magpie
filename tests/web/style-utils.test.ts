import { describe, it, expect } from 'vitest';
import { seedChosenStyle } from '../../web/src/style.js';
import type { StyleOptions } from '../../src/shared/types.js';

describe('seedChosenStyle', () => {
  it('clears a match-derived branch so manual seeds do not inherit its anchors', () => {
    const matched: StyleOptions = { branch: 'German', harshness: 0.15, complexity: 0.85, generations: 4 };
    const next = seedChosenStyle(matched);
    expect(next.branch).toBeUndefined();
  });

  it('preserves the other stylistic knobs', () => {
    const matched: StyleOptions = { branch: 'German', harshness: 0.15, complexity: 0.85, wordLength: 'long', generations: 4 };
    expect(seedChosenStyle(matched)).toEqual({ harshness: 0.15, complexity: 0.85, wordLength: 'long', generations: 4 });
  });

  it('does not mutate the input style', () => {
    const matched: StyleOptions = { branch: 'German', harshness: 0.5 };
    seedChosenStyle(matched);
    expect(matched.branch).toBe('German');
  });

  it('is a no-op for an already seed-chosen style', () => {
    const plain: StyleOptions = { harshness: 0.5, complexity: 0.5 };
    expect(seedChosenStyle(plain)).toEqual(plain);
  });
});
