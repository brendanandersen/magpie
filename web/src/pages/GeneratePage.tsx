import type React from 'react';
import type { LanguageDefinition, StyleOptions } from '../../../src/shared/types';
import type { SavedLanguage } from '../../../src/shared/saved';
import { MatchPanel } from '../components/MatchPanel';
import { SavedLanguages } from '../components/SavedLanguages';

export interface GeneratePageProps {
  seedInput: string;
  onSeedInput: (value: string) => void;
  onGenerate: () => void;
  onRandom: () => void;
  loading: boolean;
  onLoadMatch: (seed: string, style: StyleOptions) => void;
  language: LanguageDefinition | null;
  onContinue: () => void;
  saved: SavedLanguage[];
  activeSeed: string;
  onLoadSaved: (entry: SavedLanguage) => void;
  onDeleteSaved: (seed: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  error: string | null;
}

function OptionCard({
  title,
  hint,
  accent,
  children,
}: {
  title: string;
  hint: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border p-5 ${
        accent ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-800 bg-slate-900/60'
      }`}
    >
      <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">{title}</h2>
      <p className="mb-4 text-sm text-slate-500">{hint}</p>
      {children}
    </section>
  );
}

export function GeneratePage(props: GeneratePageProps) {
  const {
    seedInput,
    onSeedInput,
    onGenerate,
    onRandom,
    loading,
    onLoadMatch,
    language,
    onContinue,
    saved,
    activeSeed,
    onLoadSaved,
    onDeleteSaved,
    onExport,
    onImport,
    error,
  } = props;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-10 text-center">
        <h1 className="font-conlang text-6xl font-bold text-amber-300">Magpie</h1>
        <p className="mt-2 text-slate-400">
          A new language, borrowed from the old — descended from Proto-Indo-European.
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Choose any starting point below, then customize its sound changes.
        </p>
      </header>

      {error && <div className="mb-6 rounded-lg border border-red-800 bg-red-950/50 p-3 text-red-300">{error}</div>}

      <div className="space-y-6">
        {language && (
          <OptionCard title="Current language" hint="Pick up where you left off with the language you have loaded." accent>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="font-conlang text-xl text-amber-200">{language.name}</span>
                <span className="ml-2 font-mono text-xs text-slate-500">{language.seed}</span>
              </div>
              <button
                onClick={onContinue}
                className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-slate-950 hover:bg-amber-400"
              >
                Customize sound changes →
              </button>
            </div>
          </OptionCard>
        )}

        <OptionCard title="Type a seed" hint="Any word or phrase deterministically grows a whole language.">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={seedInput}
              onChange={(e) => onSeedInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onGenerate()}
              className="w-64 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-slate-100 outline-none focus:border-amber-500"
              placeholder="enter a seed…"
            />
            <button
              onClick={onGenerate}
              disabled={loading}
              className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {loading ? 'Conjuring…' : 'Generate →'}
            </button>
          </div>
        </OptionCard>

        <OptionCard title="Random seed" hint="Let Magpie pick a seed for you at random.">
          <button
            onClick={onRandom}
            disabled={loading}
            className="rounded-lg border border-slate-700 px-4 py-2 text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            Randomize
          </button>
        </OptionCard>

        <MatchPanel onLoad={onLoadMatch} />

        <SavedLanguages
          saved={saved}
          activeSeed={activeSeed}
          onLoad={onLoadSaved}
          onDelete={onDeleteSaved}
          onExport={onExport}
          onImport={onImport}
        />
      </div>

      <footer className="mt-12 text-center text-xs text-slate-600">
        Built with the Etymology Atlas dataset · runs fully locally
      </footer>
    </div>
  );
}
