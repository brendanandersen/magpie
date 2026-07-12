/**
 * Phase 1 - Data Extraction Pipeline
 *
 * Reads the raw Parquet files in ./data via DuckDB and emits a compact JSON data
 * slice under ./data-build for the runtime app (which never touches Parquet):
 *
 *   data-build/ancestor-index.json     englishHeadword -> ranked ancestor roots
 *   data-build/core-words.json         curated core vocabulary resolved in the index
 *   data-build/phoneme-inventories.json hand-mapped source inventories (PHOIBLE)
 *   data-build/typology.json           WALS feature value distributions
 *   data-build/meta.json               build provenance + counts
 *
 * Design follows data/SCHEMA.md: English is the semantic anchor; ancestors are
 * traced through the etymology graph, preferring the deepest reachable ancestor
 * (PIE), with cognate_sets excluded (no proto form / empty concept).
 *
 * Usage: npm run build-data
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import { transliterate } from '../src/core/translit.js';
import type {
  AncestorCandidate,
  AncestorIndex,
  BuildMeta,
  PhonemeInventory,
  TypologyFeature,
  TypologyIndex,
} from '../src/core/data-model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const OUT_DIR = path.resolve(__dirname, '..', 'data-build');

const ety = `read_parquet('${path.join(DATA_DIR, 'etymologies.parquet')}')`;
const pho = `read_parquet('${path.join(DATA_DIR, 'phonemes.parquet')}')`;
const feat = `read_parquet('${path.join(DATA_DIR, 'linguistic_features.parquet')}')`;

/**
 * Ancestor languages we accept, mapped to a depth weight (higher = older/deeper).
 * Deeper ancestors are preferred so the "descended from PIE" narrative holds; modern
 * donor languages are included at low depth so borrowings still resolve (hybrid scope).
 */
const ANCESTOR_DEPTH: Record<string, number> = {
  'proto-indo-european': 6,
  'proto-germanic': 5,
  'proto-west germanic': 5,
  'proto-italic': 5,
  gothic: 4,
  'old english': 4,
  'old norse': 4,
  'old high german': 4,
  'old dutch': 4,
  'old saxon': 4,
  'middle english': 3,
  'middle french': 3,
  'middle dutch': 3,
  'old french': 3,
  latin: 2,
  'late latin': 2,
  'medieval latin': 2,
  'new latin': 2,
  'ancient greek': 2,
  sanskrit: 2,
  // modern donors (borrowings) at low depth
  french: 1,
  german: 1,
  dutch: 1,
  italian: 1,
  spanish: 1,
  'anglo-norman': 1,
};

/** Intermediate stages used for the 2-hop reach into proto ancestors. */
const HOP_INTERMEDIATES = ['old english', 'middle english', 'old norse', 'old high german'];
const PROTO_LANGS = ['proto-indo-european', 'proto-germanic', 'proto-west germanic'];

/** Relationship reliability weighting for scoring. */
const REL_SCORE: Record<string, number> = {
  inherited: 1.0,
  derived: 0.9,
  cognate: 0.6,
  borrowed: 0.5,
  compound: 0.4,
  calque: 0.4,
  blend: 0.3,
  clipping: 0.3,
  back_formation: 0.3,
  abbreviation: 0.2,
  other: 0.2,
};

/**
 * Curated core vocabulary (Swadesh-ish basics + common function words). These are
 * the "tier 1" words we most want to resolve reliably for demo sentences.
 */
const CORE_WORDS: string[] = [
  // pronouns / determiners
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'this', 'that', 'who', 'what', 'the', 'a',
  // family / people
  'mother', 'father', 'brother', 'sister', 'son', 'daughter', 'man', 'woman', 'child', 'friend', 'name',
  // body
  'head', 'eye', 'ear', 'nose', 'mouth', 'tooth', 'tongue', 'heart', 'hand', 'foot', 'blood', 'bone',
  // nature
  'water', 'fire', 'earth', 'air', 'sun', 'moon', 'star', 'sky', 'sea', 'river', 'mountain', 'tree',
  'stone', 'wind', 'rain', 'snow', 'night', 'day',
  // animals
  'dog', 'cat', 'horse', 'cow', 'bird', 'fish', 'wolf', 'bear', 'mouse', 'raven', 'snake',
  // verbs
  'be', 'have', 'do', 'go', 'come', 'see', 'hear', 'eat', 'drink', 'sleep', 'live', 'die',
  'give', 'take', 'know', 'think', 'say', 'stand', 'sit', 'run', 'walk', 'love', 'bear', 'wear',
  // adjectives
  'big', 'small', 'long', 'good', 'bad', 'new', 'old', 'young', 'cold', 'warm', 'full', 'red',
  'white', 'black', 'green', 'brown',
  // numbers
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'hundred',
  // misc common nouns
  'word', 'book', 'house', 'door', 'field', 'road', 'king', 'queen', 'god', 'year', 'month',
  'milk', 'bread', 'salt', 'wheel', 'yoke', 'free', 'guest', 'town',
];

/** Phoneme-source language name -> dataset language name(s) whose modern reflexes to collect. */
const SOURCE_TO_DATASET_LANGS: Record<string, string[]> = {
  German: ['german'],
  French: ['french'],
  Russian: ['russian'],
  Icelandic: ['icelandic'],
  Greek: ['greek', 'ancient greek'],
  Sanskrit: ['sanskrit'],
};

/** Relationship types indicating a genuine reflex/cognate, with reliability priority. */
const REFLEX_REL_TYPES = ['inherited', 'cognate', 'derived', 'borrowed'];
const REFLEX_REL_PRIORITY: Record<string, number> = { inherited: 4, cognate: 3, derived: 2, borrowed: 1 };

/** Candidate glottocodes (hand-mapped IE source languages present in PHOIBLE). */
const PHONEME_SOURCES: { name: string; glottocode: string }[] = [
  { name: 'German', glottocode: 'stan1295' },
  { name: 'English', glottocode: 'stan1293' },
  { name: 'Greek', glottocode: 'mode1248' },
  { name: 'Russian', glottocode: 'russ1263' },
  { name: 'Icelandic', glottocode: 'icel1247' },
  { name: 'Sanskrit', glottocode: 'sans1269' },
  { name: 'French', glottocode: 'stan1290' },
];

/** WALS features we sample for grammar, with human-readable value labels. */
const WALS_FEATURES: { id: string; name: string; labels: Record<number, string> }[] = [
  {
    id: '81A',
    name: 'Order of Subject, Object and Verb',
    labels: { 1: 'SOV', 2: 'SVO', 3: 'VSO', 4: 'VOS', 5: 'OVS', 6: 'OSV', 7: 'No dominant order' },
  },
  {
    id: '87A',
    name: 'Order of Adjective and Noun',
    labels: { 1: 'Adjective-Noun', 2: 'Noun-Adjective', 3: 'No dominant order' },
  },
  {
    id: '49A',
    name: 'Number of Cases',
    labels: {
      1: 'No morphological case', 2: '2 cases', 3: '3 cases', 4: '4 cases', 5: '5 cases',
      6: '6-7 cases', 7: '8-9 cases', 8: '10+ cases', 9: 'Exclusively borderline case marking',
    },
  },
  {
    id: '33A',
    name: 'Coding of Nominal Plurality',
    labels: {
      1: 'Plural suffix', 2: 'Plural prefix', 3: 'Plural stem change', 4: 'Plural tone',
      5: 'Plural complete reduplication', 6: 'Mixed morphological plural', 7: 'Plural word',
      8: 'Plural clitic', 9: 'No plural',
    },
  },
  {
    id: '51A',
    name: 'Position of Case Affixes',
    labels: {
      1: 'Case suffixes', 2: 'Case prefixes', 3: 'Case tone', 4: 'Case stem change',
      5: 'Case inpositions', 6: 'Mixed morphological case', 7: 'No case affixes', 9: 'No case marking',
    },
  },
];

function num(v: unknown): number {
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'number') return v;
  return Number(v ?? 0);
}

function str(v: unknown): string {
  return v == null ? '' : String(v);
}

async function rows(conn: DuckDBConnection, sql: string): Promise<Record<string, unknown>[]> {
  const reader = await conn.runAndReadAll(sql);
  return reader.getRowObjects() as Record<string, unknown>[];
}

function sqlList(values: string[]): string {
  return values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');
}

function scoreCandidate(c: Omit<AncestorCandidate, 'score'>): number {
  const rel = REL_SCORE[c.relationshipType] ?? 0.2;
  return c.depth * 2 + rel + c.confidence;
}

/** Build the English -> ancestor-root index from direct and 2-hop edges. */
async function buildAncestorIndex(conn: DuckDBConnection): Promise<AncestorIndex> {
  const acceptedLangs = Object.keys(ANCESTOR_DEPTH);

  // Direct edges: english -> ancestor.
  const directSql = `
    SELECT lower(term1) AS w, term2 AS form, lang2 AS lang,
           relationship_type AS rel, confidence AS conf
    FROM ${ety}
    WHERE lang1 = 'english'
      AND lang2 IN (${sqlList(acceptedLangs)})
      AND regexp_full_match(lower(term1), '[a-z]+')
      AND term2 <> '' AND term2 <> '*-' AND term2 <> '*'
  `;

  // 2-hop edges: english -> intermediate -> proto ancestor.
  const hopSql = `
    SELECT lower(a.term1) AS w, b.term2 AS form, b.lang2 AS lang,
           b.relationship_type AS rel, b.confidence AS conf
    FROM ${ety} a
    JOIN ${ety} b ON lower(a.term2) = lower(b.term1) AND a.lang2 = b.lang1
    WHERE a.lang1 = 'english'
      AND a.lang2 IN (${sqlList(HOP_INTERMEDIATES)})
      AND b.lang2 IN (${sqlList(PROTO_LANGS)})
      AND regexp_full_match(lower(a.term1), '[a-z]+')
      AND b.term2 <> '' AND b.term2 <> '*-' AND b.term2 <> '*'
  `;

  const grouped = new Map<string, Map<string, AncestorCandidate>>();

  const add = (w: string, form: string, lang: string, rel: string, conf: number, hops: number) => {
    const depth = ANCESTOR_DEPTH[lang] ?? 1;
    const confidence = hops === 2 ? conf * 0.85 : conf;
    const partial: Omit<AncestorCandidate, 'score'> = {
      form, lang, relationshipType: rel, confidence, depth, hops,
    };
    const cand: AncestorCandidate = { ...partial, score: scoreCandidate(partial) };
    let byForm = grouped.get(w);
    if (!byForm) {
      byForm = new Map();
      grouped.set(w, byForm);
    }
    const key = `${lang}|${form}`;
    const existing = byForm.get(key);
    if (!existing || cand.score > existing.score) byForm.set(key, cand);
  };

  const directRows = await rows(conn, directSql);
  for (const r of directRows) {
    add(str(r.w), str(r.form), str(r.lang), str(r.rel), num(r.conf), 1);
  }

  const hopRows = await rows(conn, hopSql);
  for (const r of hopRows) {
    add(str(r.w), str(r.form), str(r.lang), str(r.rel), num(r.conf), 2);
  }

  const index: AncestorIndex = {};
  for (const [w, byForm] of grouped) {
    const candidates = [...byForm.values()].sort((a, b) => b.score - a.score);
    index[w] = { best: candidates[0], alternates: candidates.slice(1, 5) };
  }
  return index;
}

/** Keep single-token, plausible word forms; drop phrases, affixes, and empties. */
function cleanReflexForm(form: string): string | null {
  const f = form.trim();
  if (!f || f === '*' || f === '*-' || f.includes(' ') || f.startsWith('-') || f.endsWith('-')) return null;
  return f;
}

/** Build modern-reflex lexicons (sourceName -> concept -> attested modern word). */
async function buildReflexIndex(conn: DuckDBConnection, concepts: string[]): Promise<Record<string, Record<string, string>>> {
  const conceptList = sqlList(concepts);
  const relList = sqlList(REFLEX_REL_TYPES);
  const out: Record<string, Record<string, string>> = {};

  for (const [name, langs] of Object.entries(SOURCE_TO_DATASET_LANGS)) {
    const langList = sqlList(langs);
    const sql = `
      SELECT w, form, rel, conf FROM (
        SELECT lower(term1) AS w, term2 AS form, relationship_type AS rel, confidence AS conf
          FROM ${ety}
          WHERE lang1 = 'english' AND lang2 IN (${langList})
            AND relationship_type IN (${relList}) AND lower(term1) IN (${conceptList})
        UNION ALL
        SELECT lower(term2) AS w, term1 AS form, relationship_type AS rel, confidence AS conf
          FROM ${ety}
          WHERE lang2 = 'english' AND lang1 IN (${langList})
            AND relationship_type IN (${relList}) AND lower(term2) IN (${conceptList})
      )`;
    const best = new Map<string, { form: string; rank: number }>();
    for (const r of await rows(conn, sql)) {
      const w = str(r.w);
      const form = cleanReflexForm(str(r.form));
      if (!form) continue;
      const rank = (REFLEX_REL_PRIORITY[str(r.rel)] ?? 0) * 2 + num(r.conf);
      const existing = best.get(w);
      if (!existing || rank > existing.rank) best.set(w, { form, rank });
    }
    // Romanize non-Latin forms (Cyrillic/Greek/Devanagari) so the lexical scorer can
    // compare them to our romanized output; Latin-script forms pass through unchanged.
    const map: Record<string, string> = {};
    for (const [w, v] of best) map[w] = transliterate(v.form);
    out[name] = map;
  }
  // English: the core concepts are themselves English headwords, so the reflex is identity.
  out.English = Object.fromEntries(concepts.map((c) => [c, c]));
  return out;
}

async function buildPhonemeInventories(conn: DuckDBConnection): Promise<PhonemeInventory[]> {
  const codes = PHONEME_SOURCES.map((s) => s.glottocode);
  const result = await rows(
    conn,
    `SELECT glottocode, iso_639_3, segment_class, phoneme
     FROM ${pho}
     WHERE glottocode IN (${sqlList(codes)})
       AND segment_class IN ('consonant', 'vowel')`,
  );

  const byCode = new Map<string, { iso: string; cons: Set<string>; vow: Set<string> }>();
  for (const r of result) {
    const code = str(r.glottocode);
    let acc = byCode.get(code);
    if (!acc) {
      acc = { iso: str(r.iso_639_3), cons: new Set(), vow: new Set() };
      byCode.set(code, acc);
    }
    const p = str(r.phoneme);
    if (str(r.segment_class) === 'consonant') acc.cons.add(p);
    else acc.vow.add(p);
  }

  return PHONEME_SOURCES.filter((s) => byCode.has(s.glottocode)).map((s) => {
    const acc = byCode.get(s.glottocode)!;
    return {
      name: s.name,
      glottocode: s.glottocode,
      iso639_3: acc.iso,
      consonants: [...acc.cons].sort(),
      vowels: [...acc.vow].sort(),
    };
  });
}

async function buildTypology(conn: DuckDBConnection): Promise<TypologyIndex> {
  const index: TypologyIndex = {};
  for (const f of WALS_FEATURES) {
    const result = await rows(
      conn,
      `SELECT value, COUNT(*) AS n FROM ${feat}
       WHERE feature_id = '${f.id}' GROUP BY value ORDER BY n DESC`,
    );
    const counts = result.map((r) => ({ value: num(r.value), count: num(r.n) }));
    const total = counts.reduce((s, c) => s + c.count, 0) || 1;
    const feature: TypologyFeature = {
      featureId: f.id,
      featureName: f.name,
      values: counts.map((c) => ({
        value: c.value,
        label: f.labels[c.value] ?? `${f.id}-${c.value}`,
        count: c.count,
        weight: c.count / total,
      })),
    };
    index[f.id] = feature;
  }
  return index;
}

function writeJson(file: string, data: unknown): void {
  fs.writeFileSync(path.join(OUT_DIR, file), JSON.stringify(data, null, 2), 'utf8');
}

async function main(): Promise<void> {
  if (!fs.existsSync(DATA_DIR)) throw new Error(`Data directory not found: ${DATA_DIR}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const instance = await DuckDBInstance.create(':memory:');
  const conn = await instance.connect();

  console.log('Building ancestor index...');
  const ancestorIndex = await buildAncestorIndex(conn);
  const headwords = Object.keys(ancestorIndex);
  console.log(`  ${headwords.length} English headwords indexed.`);

  console.log('Resolving core word list...');
  const coreResolved = CORE_WORDS.filter((w) => ancestorIndex[w]);
  const coreMissing = CORE_WORDS.filter((w) => !ancestorIndex[w]);
  console.log(`  ${coreResolved.length}/${CORE_WORDS.length} core words resolved.`);
  if (coreMissing.length) console.log(`  Missing (will be coined): ${coreMissing.join(', ')}`);

  console.log('Building phoneme inventories...');
  const inventories = await buildPhonemeInventories(conn);
  inventories.forEach((i) =>
    console.log(`  ${i.name}: ${i.consonants.length} consonants, ${i.vowels.length} vowels`),
  );

  console.log('Building typology distributions...');
  const typology = await buildTypology(conn);

  console.log('Building modern reflex lexicons...');
  const reflexes = await buildReflexIndex(conn, coreResolved);
  Object.entries(reflexes).forEach(([name, map]) =>
    console.log(`  ${name}: ${Object.keys(map).length}/${coreResolved.length} reflexes`),
  );

  const meta: BuildMeta = {
    generatedAt: new Date().toISOString(),
    source: 'Etymology Atlas (lukeslp/etymology-atlas), CC BY-SA 3.0',
    counts: {
      ancestorHeadwords: headwords.length,
      coreWordsResolved: coreResolved.length,
      coreWordsMissing: coreMissing.length,
      phonemeInventories: inventories.length,
      typologyFeatures: Object.keys(typology).length,
    },
    scopedAncestorLangs: Object.keys(ANCESTOR_DEPTH),
  };

  writeJson('ancestor-index.json', ancestorIndex);
  writeJson('core-words.json', coreResolved);
  writeJson('phoneme-inventories.json', inventories);
  writeJson('typology.json', typology);
  writeJson('reflexes.json', reflexes);
  writeJson('meta.json', meta);

  console.log(`\nData slice written to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
