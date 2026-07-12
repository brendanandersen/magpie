import { useMemo } from 'react';
import type { LanguageDefinition } from '../../../src/shared/types';
import { compareLanguageDNA } from '../../../src/core/language-dna';

export function DnaPanel({ language }: { language: LanguageDefinition }) {
  const matches = useMemo(() => compareLanguageDNA(language.grammar).slice(0, 5), [language.grammar]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-400/80">Language DNA</h3>
      <p className="mb-4 text-sm text-slate-500">
        Real languages whose grammatical structure most resembles {language.name}.
      </p>
      <ul className="space-y-2">
        {matches.map((m) => (
          <li key={m.name} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-slate-200">{m.name}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.round(m.similarity * 100)}%` }} />
            </div>
            <span className="w-10 shrink-0 text-right font-mono text-xs text-slate-400">
              {Math.round(m.similarity * 100)}%
            </span>
          </li>
        ))}
      </ul>
      {matches[0] && matches[0].shared.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          Shares with {matches[0].name}: {matches[0].shared.join(', ')}.
        </p>
      )}
    </div>
  );
}
