/**
 * Impure boundary: loads the Phase 1 data slice (data-build/*.json) from disk into
 * a GeneratorData object. The generator itself stays pure and takes this as input.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AncestorIndex, PhonemeInventory, ReflexIndex, TypologyIndex } from './data-model.js';
import type { GeneratorData } from './generator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.resolve(__dirname, '..', '..', 'data-build');

function readJson<T>(dir: string, file: string): T {
  const full = path.join(dir, file);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing data slice file: ${full}. Run "npm run build-data" first.`);
  }
  return JSON.parse(fs.readFileSync(full, 'utf8')) as T;
}

/** Read an optional data slice file, returning a fallback when it is absent. */
function readOptionalJson<T>(dir: string, file: string, fallback: T): T {
  const full = path.join(dir, file);
  if (!fs.existsSync(full)) return fallback;
  return JSON.parse(fs.readFileSync(full, 'utf8')) as T;
}

export function loadGeneratorData(dir: string = DEFAULT_DIR): GeneratorData {
  return {
    inventories: readJson<PhonemeInventory[]>(dir, 'phoneme-inventories.json'),
    typology: readJson<TypologyIndex>(dir, 'typology.json'),
    ancestorIndex: readJson<AncestorIndex>(dir, 'ancestor-index.json'),
    coreWords: readJson<string[]>(dir, 'core-words.json'),
    reflexes: readOptionalJson<ReflexIndex>(dir, 'reflexes.json', {}),
  };
}
