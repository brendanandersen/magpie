import type { ReactNode } from 'react';
import type { LanguageDefinition, SoundChangeRule } from '../../../src/shared/types';
import { speakPhoneme } from '../speech';
import { groupAnchorInfo, anchorPhaseLabel } from './anchors';

function PhonemeChip({
  roman,
  ipa,
  type,
  showIpa,
  canPlay,
}: {
  roman: string;
  ipa: string;
  type: 'consonant' | 'vowel';
  showIpa: boolean;
  canPlay: boolean;
}) {
  return (
    <button
      onClick={() => speakPhoneme(roman, type)}
      disabled={!canPlay}
      title={canPlay ? 'Click to hear' : 'Loading voice…'}
      className="inline-block rounded-md bg-slate-800 px-2 py-0.5 font-mono text-sm text-slate-200 hover:bg-slate-700 disabled:cursor-default disabled:hover:bg-slate-800"
    >
      {showIpa ? ipa : roman}
    </button>
  );
}

const ENV_LABELS: Record<string, string> = {
  initial: 'word-initial',
  final: 'word-final',
  intervocalic: 'between vowels',
  before_front: 'before front vowel',
};

/** Group consecutive rules that share a generation tag, preserving order. */
function groupByGeneration(rules: SoundChangeRule[]): SoundChangeRule[][] {
  const groups: SoundChangeRule[][] = [];
  let last: number | undefined;
  for (const r of rules) {
    const gen = r.generation ?? 0;
    if (groups.length === 0 || gen !== last) {
      groups.push([r]);
      last = gen;
    } else groups[groups.length - 1].push(r);
  }
  return groups;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-amber-400/80">{title}</h3>
      {children}
    </div>
  );
}

export function LanguagePanel({
  language,
  ipa,
  speechReady,
}: {
  language: LanguageDefinition;
  ipa: boolean;
  speechReady: boolean;
}) {
  const g = language.grammar;
  const ruleGroups = groupByGeneration(language.soundChangeRules);
  // Number only the generative groups; anchor groups are labelled by branch + phase.
  let genSeen = 0;
  const genNumbers = ruleGroups.map((grp) => (groupAnchorInfo(grp) ? null : (genSeen += 1)));
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="mb-4">
        <div className="text-xs uppercase tracking-widest text-slate-500">generated language</div>
        <h2 className="font-conlang text-4xl text-amber-300">{language.name}</h2>
        <div className="text-sm text-slate-400">
          seed <span className="font-mono text-slate-300">{language.seed}</span> · phonology inspired by{' '}
          {language.inventory.inspiredBy}
        </div>
      </div>

      <Section title={speechReady ? 'Phoneme inventory (click to hear)' : 'Phoneme inventory (loading voice…)'}>
        <div className="mb-2 flex flex-wrap gap-1">
          {language.inventory.consonants.map((c) => (
            <PhonemeChip key={`c-${c}`} roman={c} ipa={phonemeIpa(language, c)} type="consonant" showIpa={ipa} canPlay={speechReady} />
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {language.inventory.vowels.map((v) => (
            <PhonemeChip key={`v-${v}`} roman={v} ipa={phonemeIpa(language, v)} type="vowel" showIpa={ipa} canPlay={speechReady} />
          ))}
        </div>
      </Section>

      <Section title="Grammar">
        <ul className="space-y-1 text-sm text-slate-300">
          <li>
            word order: <span className="font-mono text-slate-100">{g.wordOrder}</span>{' '}
            <span className="text-slate-500">(WALS: {g.wordOrderSource})</span>
          </li>
          <li>
            adjective: <span className="font-mono text-slate-100">{g.adjNounOrder}</span>
          </li>
          <li>
            plural: <span className="font-mono text-slate-100">{g.pluralAffixType} “{g.pluralAffix}”</span>
          </li>
          <li>
            cases ({g.caseAffixPosition}):{' '}
            {g.cases.length ? (
              <span className="font-mono text-slate-100">
                {g.cases.map((c) => `${c.name}="${c.affix}"`).join(', ')}
              </span>
            ) : (
              <span className="text-slate-500">none</span>
            )}
          </li>
        </ul>
      </Section>

      <Section title="Sound changes (applied in order)">
        <div className="space-y-3">
          {ruleGroups.map((rules, gi) => {
            const anchor = groupAnchorInfo(rules);
            return (
              <div
                key={gi}
                className={`overflow-hidden rounded-lg border ${anchor ? 'border-sky-800/60' : 'border-slate-800'}`}
              >
                <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950/40 px-3 py-1.5">
                  {anchor ? (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-sky-300">
                        ⚓ {anchor.branch}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-widest text-sky-300/90">
                        {anchorPhaseLabel(anchor.phase)}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">
                      Generation {genNumbers[gi]}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-slate-600">
                    {rules.length} rule{rules.length === 1 ? '' : 's'}
                  </span>
                </div>
                <ul className="divide-y divide-slate-800/60">
                  {rules.map((r) => (
                    <li key={r.id} className="flex items-baseline gap-3 px-3 py-1.5">
                      <span className="shrink-0 font-mono text-sm text-slate-100">
                        {r.from || '∅'} <span className="text-slate-500">→</span> {r.to || '∅'}
                      </span>
                      {r.env !== 'any' && (
                        <span className="shrink-0 rounded bg-slate-800/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
                          {ENV_LABELS[r.env] ?? r.env}
                        </span>
                      )}
                      {r.law && (
                        <span className="ml-auto truncate pl-2 text-right text-xs italic text-sky-300/70" title={r.law}>
                          {r.law}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Sample lexicon">
        <div className="grid max-h-64 grid-cols-1 gap-x-6 gap-y-1 overflow-y-auto pr-2 text-sm sm:grid-cols-2">
          {language.lexicon.slice(0, 40).map((w) => (
            <div key={w.english} className="flex items-baseline justify-between border-b border-slate-800/60 py-0.5">
              <span className="text-slate-400">{w.english}</span>
              <span className="font-conlang text-slate-100">{ipa ? `/${w.ipa}/` : w.roman}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function phonemeIpa(language: LanguageDefinition, roman: string): string {
  return language.inventory.phonemes.find((p) => p.roman === roman)?.ipa ?? roman;
}
