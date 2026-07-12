import { describe, it, expect } from 'vitest';
import { Rng } from '../../src/core/rng.js';

describe('Rng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = new Rng('magpie');
    const b = new Rng('magpie');
    const seqA = Array.from({ length: 10 }, () => a.float());
    const seqB = Array.from({ length: 10 }, () => b.float());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = new Rng('seed-one');
    const b = new Rng('seed-two');
    const seqA = Array.from({ length: 10 }, () => a.float());
    const seqB = Array.from({ length: 10 }, () => b.float());
    expect(seqA).not.toEqual(seqB);
  });

  it('float stays within [0, 1)', () => {
    const r = new Rng('range');
    for (let i = 0; i < 1000; i++) {
      const v = r.float();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int is inclusive and within bounds', () => {
    const r = new Rng('ints');
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = r.int(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect(seen).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  it('weightedPick favors heavier items', () => {
    const r = new Rng('weights');
    const items = ['rare', 'common'];
    let common = 0;
    for (let i = 0; i < 1000; i++) {
      if (r.weightedPick(items, (x) => (x === 'common' ? 9 : 1)) === 'common') common++;
    }
    expect(common).toBeGreaterThan(800);
  });

  it('sample returns distinct items and is deterministic', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const s1 = new Rng('s').sample(arr, 4);
    const s2 = new Rng('s').sample(arr, 4);
    expect(s1).toEqual(s2);
    expect(new Set(s1).size).toBe(4);
  });
});
