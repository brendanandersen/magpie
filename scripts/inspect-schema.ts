/**
 * Phase 0 - Data Exploration & Schema Lock
 *
 * Runs against the downloaded Parquet files in ./data to:
 *   1. Print the real column names + types for every file (resolves the
 *      README vs HuggingFace-card schema discrepancy noted in spec.md).
 *   2. Show a few sample rows per file.
 *   3. Report distinct relationship types (with counts).
 *   4. Probe for Proto-Indo-European / ancestor forms to answer the open
 *      "ancestor anchor" question in spec.md Section 8.
 *
 * Usage: npm run inspect
 *
 * This is read-only. Nothing is written and nothing leaves the machine.
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');

const FILES = [
  'etymologies.parquet',
  'languages.parquet',
  'cognate_sets.parquet',
  'phonemes.parquet',
  'linguistic_features.parquet',
] as const;

const ANCESTOR_TERMS = [
  'Proto-Indo-European',
  'Proto-Germanic',
  'Proto-Italic',
  'Latin',
  'Ancient Greek',
  'Proto-Balto-Slavic',
];

interface ColumnInfo {
  name: string;
  type: string;
}

/** Make DuckDB row objects (which may contain BigInt) safe to log. */
function safe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(safe);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, safe(v)]),
    );
  }
  return value;
}

async function rows(conn: DuckDBConnection, sql: string): Promise<Record<string, unknown>[]> {
  const reader = await conn.runAndReadAll(sql);
  return reader.getRowObjects() as Record<string, unknown>[];
}

/** Run a query but never abort the whole run on failure. */
async function tryRows(
  conn: DuckDBConnection,
  sql: string,
): Promise<Record<string, unknown>[] | null> {
  try {
    return await rows(conn, sql);
  } catch (err) {
    console.log(`    (query failed: ${(err as Error).message})`);
    return null;
  }
}

function parquet(file: string): string {
  // Escape single quotes defensively; file names here are static/trusted.
  const abs = path.join(DATA_DIR, file).replace(/'/g, "''");
  return `read_parquet('${abs}')`;
}

async function describe(conn: DuckDBConnection, file: string): Promise<ColumnInfo[]> {
  const result = await rows(conn, `DESCRIBE SELECT * FROM ${parquet(file)}`);
  return result.map((r) => ({
    name: String(r.column_name),
    type: String(r.column_type),
  }));
}

function varcharColumns(cols: ColumnInfo[]): string[] {
  return cols.filter((c) => /VARCHAR|STRING|TEXT/i.test(c.type)).map((c) => c.name);
}

async function inspectFile(conn: DuckDBConnection, file: string): Promise<ColumnInfo[]> {
  console.log('\n' + '='.repeat(78));
  console.log(`FILE: ${file}`);
  console.log('='.repeat(78));

  const cols = await describe(conn, file);
  console.log('\nColumns:');
  for (const c of cols) console.log(`  - ${c.name}: ${c.type}`);

  const count = await tryRows(conn, `SELECT COUNT(*) AS n FROM ${parquet(file)}`);
  if (count) console.log(`\nRow count: ${safe(count[0]?.n)}`);

  const sample = await tryRows(conn, `SELECT * FROM ${parquet(file)} LIMIT 3`);
  if (sample) {
    console.log('\nSample rows:');
    sample.forEach((r, i) => console.log(`  [${i}] ${JSON.stringify(safe(r))}`));
  }

  return cols;
}

/** Report distinct values (with counts) for a likely "relationship type" column. */
async function reportRelationshipTypes(
  conn: DuckDBConnection,
  file: string,
  cols: ColumnInfo[],
): Promise<void> {
  const typeCol = cols.find((c) => /relationship_type|relation_type|type/i.test(c.name));
  if (!typeCol) return;
  console.log(`\nDistinct "${typeCol.name}" values:`);
  const result = await tryRows(
    conn,
    `SELECT "${typeCol.name}" AS t, COUNT(*) AS n
     FROM ${parquet(file)}
     GROUP BY 1 ORDER BY n DESC`,
  );
  result?.forEach((r) => console.log(`  - ${safe(r.t)}: ${safe(r.n)}`));
}

/**
 * Probe every VARCHAR column across etymologies/languages/cognate_sets for the
 * presence of ancestor languages (esp. Proto-Indo-European). Answers whether we
 * can anchor generation on real PIE reconstructions or must fall back to a proxy.
 */
async function probeAncestors(
  conn: DuckDBConnection,
  file: string,
  cols: ColumnInfo[],
): Promise<void> {
  const textCols = varcharColumns(cols);
  if (textCols.length === 0) return;

  console.log(`\nAncestor probe in ${file}:`);
  for (const term of ANCESTOR_TERMS) {
    const escaped = term.replace(/'/g, "''");
    const orClause = textCols
      .map((c) => `"${c}" ILIKE '%${escaped}%'`)
      .join(' OR ');
    const result = await tryRows(
      conn,
      `SELECT COUNT(*) AS n FROM ${parquet(file)} WHERE ${orClause}`,
    );
    const n = result ? safe(result[0]?.n) : '?';
    console.log(`  - "${term}": ${n} matching rows`);
  }
}

async function main(): Promise<void> {
  if (!fs.existsSync(DATA_DIR)) {
    throw new Error(`Data directory not found: ${DATA_DIR}`);
  }

  const instance = await DuckDBInstance.create(':memory:');
  const conn = await instance.connect();

  console.log(`Inspecting Parquet files in: ${DATA_DIR}`);

  const schemas: Record<string, ColumnInfo[]> = {};
  for (const file of FILES) {
    const abs = path.join(DATA_DIR, file);
    if (!fs.existsSync(abs)) {
      console.log(`\n(skipping missing file: ${file})`);
      continue;
    }
    schemas[file] = await inspectFile(conn, file);
  }

  console.log('\n\n' + '#'.repeat(78));
  console.log('# TARGETED PROBES');
  console.log('#'.repeat(78));

  if (schemas['etymologies.parquet']) {
    await reportRelationshipTypes(conn, 'etymologies.parquet', schemas['etymologies.parquet']);
    await probeAncestors(conn, 'etymologies.parquet', schemas['etymologies.parquet']);
  }
  if (schemas['languages.parquet']) {
    await probeAncestors(conn, 'languages.parquet', schemas['languages.parquet']);
  }
  if (schemas['cognate_sets.parquet']) {
    await probeAncestors(conn, 'cognate_sets.parquet', schemas['cognate_sets.parquet']);
  }

  console.log('\nDone. Review output above and record findings in data/SCHEMA.md.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
