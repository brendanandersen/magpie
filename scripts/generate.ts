/**
 * CLI demo for the Phase 2 generator: prints a generated language for a seed.
 * Usage: npm run generate [seed]
 */

import { loadGeneratorData } from '../src/core/data-loader.js';
import { generateLanguage } from '../src/core/generator.js';

function main(): void {
  const seed = process.argv[2] ?? 'magpie';
  const data = loadGeneratorData();
  const lang = generateLanguage(seed, data);

  console.log(`\n=== Magpie language "${lang.name}" (seed: "${seed}") ===\n`);

  console.log(`Phoneme inventory (inspired by ${lang.inventory.inspiredBy}):`);
  console.log(`  consonants: ${lang.inventory.consonants.join(' ')}`);
  console.log(`  vowels:     ${lang.inventory.vowels.join(' ')}`);

  console.log(`\nPhonotactics: onsetMax=${lang.phonotactics.onsetMax}, codaMax=${lang.phonotactics.codaMax}, templates=[${lang.phonotactics.templates.join(', ')}]`);

  const g = lang.grammar;
  console.log('\nGrammar:');
  console.log(`  word order:      ${g.wordOrder} (WALS: ${g.wordOrderSource})`);
  console.log(`  adjective order: ${g.adjNounOrder}`);
  console.log(`  plural:          ${g.pluralAffixType} "${g.pluralAffix}"`);
  console.log(`  cases (${g.caseAffixPosition}): ${g.cases.map((c) => `${c.name}="${c.affix}"`).join(', ') || '(none)'}`);

  console.log('\nSound-change rules (applied in order):');
  lang.soundChangeRules.forEach((r, i) => console.log(`  ${i + 1}. ${r.description}`));

  console.log('\nSample lexicon (english -> word [IPA]  <= ancestor):');
  for (const w of lang.lexicon.slice(0, 30)) {
    const origin = w.origin === 'coined' ? '(coined)' : `<= ${w.ancestorForm} [${w.ancestorLang}]`;
    console.log(`  ${w.english.padEnd(9)} -> ${w.roman.padEnd(12)} [${w.ipa}]  ${origin}`);
  }

  console.log('');
}

main();
