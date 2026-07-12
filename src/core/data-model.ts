/**
 * Shared types for the Magpie data slice produced by scripts/build-data.ts and
 * consumed at runtime by the generator/translator. These describe the compact
 * JSON emitted under data-build/ (runtime never touches the raw Parquet).
 */

/** A single ancestor-root candidate for an English headword. */
export interface AncestorCandidate {
  /** Ancestor word form as it appears in the dataset (e.g. PIE "*werdʰh₁om"). */
  form: string;
  /** Lowercased ancestor language name (e.g. "proto-indo-european"). */
  lang: string;
  /** Etymology edge relationship (e.g. "inherited", "derived", "borrowed"). */
  relationshipType: string;
  /** Source-edge confidence (0..1). For 2-hop candidates, already discounted. */
  confidence: number;
  /** Ancestor-depth weight: higher = older/deeper (PIE highest). */
  depth: number;
  /** Number of graph hops from English to this ancestor (1 = direct). */
  hops: number;
  /** Composite ranking score (depth-dominant). */
  score: number;
}

/** The best ancestor plus a few alternates for one English headword. */
export interface AncestorEntry {
  best: AncestorCandidate;
  alternates: AncestorCandidate[];
}

/** englishHeadword -> ranked ancestor candidates. */
export type AncestorIndex = Record<string, AncestorEntry>;

/** A hand-mapped source phoneme inventory (from PHOIBLE). */
export interface PhonemeInventory {
  name: string;
  glottocode: string;
  iso639_3: string;
  consonants: string[];
  vowels: string[];
}

/** One value of a WALS typological feature with a sampling weight. */
export interface TypologyValue {
  value: number;
  label: string;
  count: number;
  weight: number;
}

/** A WALS feature and its attested value distribution. */
export interface TypologyFeature {
  featureId: string;
  featureName: string;
  values: TypologyValue[];
}

/** featureId -> distribution. */
export type TypologyIndex = Record<string, TypologyFeature>;

/**
 * Modern reflex lexicon: for each phoneme-source language (e.g. "German"), the
 * attested modern word for an English core concept (e.g. water -> "Wasser").
 * Used to score how closely a seed's PIE-derived output lands on the real word.
 */
export type ReflexIndex = Record<string, Record<string, string>>;

/** Build metadata / provenance for the emitted data slice. */
export interface BuildMeta {
  generatedAt: string;
  source: string;
  counts: {
    ancestorHeadwords: number;
    coreWordsResolved: number;
    coreWordsMissing: number;
    phonemeInventories: number;
    typologyFeatures: number;
  };
  scopedAncestorLangs: string[];
}
