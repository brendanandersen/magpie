/**
 * Extracts modern target-language reflexes for the core vocabulary from the raw
 * etymology graph and writes data-build/reflexes.json:
 *
 *   { "German": { "water": "Wasser", "cold": "kalt", ... }, "French": { ... } }
 *
 * These are the attested modern words for each English concept, used by the
 * seed-approximation search to score how closely a seed's PIE-derived output lands
 * on the real word (see src/core/language-match.ts). Runtime never touches Parquet;
 * this is a build-time step. Usage: npm run build-reflexes
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import { transliterate } from '../src/core/translit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const OUT_DIR = path.resolve(__dirname, '..', 'data-build');

const ety = `read_parquet('${path.join(DATA_DIR, 'etymologies.parquet')}')`;

/** Phoneme-source language name -> dataset language name(s) whose reflexes to collect. */
const SOURCE_TO_DATASET_LANGS: Record<string, string[]> = {
  German: ['german'],
  French: ['french'],
  Russian: ['russian'],
  Icelandic: ['icelandic'],
  Greek: ['greek', 'ancient greek'],
  Sanskrit: ['sanskrit'],
};

/** Relationship types that indicate a genuine reflex/cognate (not a loose association). */
const REL_TYPES = ['inherited', 'cognate', 'derived', 'borrowed'];
const REL_PRIORITY: Record<string, number> = { inherited: 4, cognate: 3, derived: 2, borrowed: 1 };

function str(v: unknown): string {
  return v == null ? '' : String(v);
}
function num(v: unknown): number {
  if (typeof v === 'bigint') return Number(v);
  return Number(v ?? 0);
}
function sqlList(values: string[]): string {
  return values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');
}

async function rows(conn: DuckDBConnection, sql: string): Promise<Record<string, unknown>[]> {
  const reader = await conn.runAndReadAll(sql);
  return reader.getRowObjects() as Record<string, unknown>[];
}

/** Keep single-token, plausible word forms; drop phrases, affixes, and empties. */
function cleanForm(form: string): string | null {
  const f = form.trim();
  if (!f || f === '*' || f === '*-' || f.includes(' ') || f.startsWith('-') || f.endsWith('-')) return null;
  return f;
}

async function buildReflexesFor(
  conn: DuckDBConnection,
  datasetLangs: string[],
  concepts: string[],
): Promise<Record<string, string>> {
  const langList = sqlList(datasetLangs);
  const conceptList = sqlList(concepts);
  const relList = sqlList(REL_TYPES);
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
    const form = cleanForm(str(r.form));
    if (!form) continue;
    // rank by relationship reliability then confidence
    const rank = (REL_PRIORITY[str(r.rel)] ?? 0) * 2 + num(r.conf);
    const existing = best.get(w);
    if (!existing || rank > existing.rank) best.set(w, { form, rank });
  }

  // Romanize non-Latin forms (Cyrillic/Greek/Devanagari) so the lexical scorer can
  // compare them to our romanized output; Latin-script forms pass through unchanged.
  const out: Record<string, string> = {};
  for (const [w, v] of best) out[w] = transliterate(v.form);
  return out;
}

async function main(): Promise<void> {
  if (!fs.existsSync(DATA_DIR)) throw new Error(`Data directory not found: ${DATA_DIR}`);
  const coreFile = path.join(OUT_DIR, 'core-words.json');
  if (!fs.existsSync(coreFile)) throw new Error('Missing data-build/core-words.json. Run "npm run build-data" first.');
  const concepts = JSON.parse(fs.readFileSync(coreFile, 'utf8')) as string[];

  const instance = await DuckDBInstance.create(':memory:');
  const conn = await instance.connect();

  const reflexes: Record<string, Record<string, string>> = {};
  for (const [name, langs] of Object.entries(SOURCE_TO_DATASET_LANGS)) {
    const map = await buildReflexesFor(conn, langs, concepts);
    reflexes[name] = map;
    console.log(`  ${name}: ${Object.keys(map).length}/${concepts.length} reflexes`);
  }
  // English: the core concepts are themselves English headwords, so the reflex is identity.
  reflexes.English = Object.fromEntries(concepts.map((c) => [c, c]));
  console.log(`  English: ${concepts.length}/${concepts.length} reflexes (identity)`);

  fs.writeFileSync(path.join(OUT_DIR, 'reflexes.json'), JSON.stringify(reflexes, null, 2), 'utf8');
  console.log(`\nreflexes.json written to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
