import { describe, it, expect } from 'vitest';
import {
  isAnchorRule,
  anchorInfo,
  groupAnchorInfo,
  anchorPhaseLabel,
} from '../../web/src/components/anchors.js';
import type { SoundChangeRule } from '../../src/shared/types.js';

const earlyAnchor: SoundChangeRule = {
  id: 'anchor_German_early_1_d_t_any',
  description: '[German] d → t',
  from: 'd',
  to: 't',
  env: 'any',
  generation: 0,
};
const lateAnchor: SoundChangeRule = {
  id: 'anchor_German_late_0_t_s_intervocalic',
  description: '[German] t → s /intervocalic',
  from: 't',
  to: 's',
  env: 'intervocalic',
  generation: 4,
};
const generative: SoundChangeRule = {
  id: 'gen_x',
  description: 'p → f',
  from: 'p',
  to: 'f',
  env: 'any',
  generation: 2,
};

describe('anchor presentation helpers', () => {
  it('detects anchor rules by id prefix', () => {
    expect(isAnchorRule(earlyAnchor)).toBe(true);
    expect(isAnchorRule(lateAnchor)).toBe(true);
    expect(isAnchorRule(generative)).toBe(false);
  });

  it('parses branch and phase from anchor rules', () => {
    expect(anchorInfo(earlyAnchor)).toEqual({ branch: 'German', phase: 'early' });
    expect(anchorInfo(lateAnchor)).toEqual({ branch: 'German', phase: 'late' });
    expect(anchorInfo(generative)).toBeNull();
  });

  it('recovers branch/phase from the id when the description was rewritten by an edit', () => {
    const edited: SoundChangeRule = { ...lateAnchor, description: 't → s / between vowels' };
    expect(anchorInfo(edited)).toEqual({ branch: 'German', phase: 'late' });
  });

  it('treats a group as anchored only when every rule is an anchor', () => {
    expect(groupAnchorInfo([earlyAnchor])).toEqual({ branch: 'German', phase: 'early' });
    expect(groupAnchorInfo([lateAnchor, lateAnchor])).toEqual({ branch: 'German', phase: 'late' });
    expect(groupAnchorInfo([generative])).toBeNull();
    expect(groupAnchorInfo([earlyAnchor, generative])).toBeNull();
    expect(groupAnchorInfo([])).toBeNull();
  });

  it('labels anchor phases', () => {
    expect(anchorPhaseLabel('early')).toBe('proto-stage laws');
    expect(anchorPhaseLabel('late')).toBe('defining shift');
  });
});
