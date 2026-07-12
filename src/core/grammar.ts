/**
 * Grammar generation: samples typological parameters (word order, adjective-noun
 * order, case system, plural strategy) from the WALS value distributions in the
 * data slice, weighted by their real cross-linguistic frequencies.
 */

import { Rng } from './rng.js';
import type { CaseDef, GrammarParams, LanguageInventory } from './language.js';
import type { TypologyIndex, TypologyValue } from './data-model.js';

const CONCRETE_ORDERS: GrammarParams['wordOrder'][] = ['SOV', 'SVO', 'VSO', 'VOS', 'OVS', 'OSV'];
const CASE_NAMES = ['nominative', 'accusative', 'genitive', 'dative'];
const MAX_CASES = 4;

function sampleValue(rng: Rng, typology: TypologyIndex, featureId: string): TypologyValue | undefined {
  const feature = typology[featureId];
  if (!feature || feature.values.length === 0) return undefined;
  return rng.weightedPick(feature.values, (v) => v.weight);
}

/** Build a short affix (V, VC, or CV) from the inventory. */
function makeAffix(rng: Rng, inv: LanguageInventory): string {
  const shape = rng.pick(['V', 'VC', 'CV']);
  const c = () => rng.pick(inv.consonants);
  const v = () => rng.pick(inv.vowels);
  switch (shape) {
    case 'V':
      return v();
    case 'VC':
      return v() + c();
    case 'CV':
    default:
      return c() + v();
  }
}

function caseCountFromLabel(label: string | undefined): number {
  if (!label) return 0;
  if (label.startsWith('No morphological')) return 0;
  if (label.startsWith('Exclusively borderline')) return 1;
  const m = label.match(/(\d+)/);
  if (!m) return 0;
  return Math.min(parseInt(m[1], 10), MAX_CASES);
}

export function buildGrammar(rng: Rng, typology: TypologyIndex, inv: LanguageInventory): GrammarParams {
  const orderVal = sampleValue(rng, typology, '81A');
  const orderLabel = orderVal?.label ?? 'SVO';
  const wordOrder = (CONCRETE_ORDERS as string[]).includes(orderLabel)
    ? (orderLabel as GrammarParams['wordOrder'])
    : rng.pick(CONCRETE_ORDERS);

  const adjVal = sampleValue(rng, typology, '87A');
  const adjNounOrder: GrammarParams['adjNounOrder'] =
    adjVal?.label === 'Adjective-Noun'
      ? 'adjective-noun'
      : adjVal?.label === 'Noun-Adjective'
        ? 'noun-adjective'
        : rng.pick(['adjective-noun', 'noun-adjective']);

  const caseCount = caseCountFromLabel(sampleValue(rng, typology, '49A')?.label);
  const caseAffixPosition: GrammarParams['caseAffixPosition'] =
    sampleValue(rng, typology, '51A')?.label === 'Case prefixes' ? 'prefix' : 'suffix';
  const cases: CaseDef[] = CASE_NAMES.slice(0, caseCount).map((name) => ({
    name,
    affix: makeAffix(rng, inv),
  }));

  const pluralAffixType: GrammarParams['pluralAffixType'] =
    sampleValue(rng, typology, '33A')?.label === 'Plural prefix' ? 'prefix' : 'suffix';
  const pluralAffix = makeAffix(rng, inv);

  return {
    wordOrder,
    wordOrderSource: orderLabel,
    adjNounOrder,
    pluralAffix,
    pluralAffixType,
    cases,
    caseAffixPosition,
  };
}
