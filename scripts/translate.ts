/**
 * CLI demo for the Phase 3 translator.
 * Usage: npm run translate -- <seed> "<english sentence>"
 * Example: npm run translate -- magpie "The mother gave water to the brothers"
 */

import { loadGeneratorData } from '../src/core/data-loader.js';
import { generateLanguage } from '../src/core/generator.js';
import { translate } from '../src/core/translator.js';

function main(): void {
  const seed = process.argv[2] ?? 'magpie';
  const sentence = process.argv.slice(3).join(' ') || 'The mother gave water to the brothers';

  const data = loadGeneratorData();
  const lang = generateLanguage(seed, data);
  const result = translate(sentence, lang, data.ancestorIndex);

  console.log(`\nLanguage "${lang.name}" (seed: "${seed}", word order: ${result.wordOrder})\n`);
  console.log(`English:  ${result.input}`);
  console.log(`${lang.name}: ${result.output}`);
  console.log(`IPA:      ${result.outputIpa}\n`);

  console.log('Word-by-word gloss:');
  for (const t of result.tokens) {
    if (!t.isWord) continue;
    console.log(`  ${t.surface.padEnd(12)} -> ${(t.roman ?? '').padEnd(14)} [${t.ipa}]`);
    for (const note of t.notes) console.log(`${' '.repeat(20)}- ${note}`);
    if (t.derivation && t.derivation.length) {
      const steps = t.derivation.map((d) => `${d.before}→${d.after} (${d.description})`).join(', ');
      console.log(`${' '.repeat(20)}- sound changes: ${steps}`);
    }
  }
  console.log('');
}

main();
