import { useRef } from 'react';
import type { SavedLanguage } from '../../../src/shared/saved';

export function SavedLanguages({
  saved,
  activeSeed,
  onLoad,
  onDelete,
  onExport,
  onImport,
}: {
  saved: SavedLanguage[];
  activeSeed: string;
  onLoad: (entry: SavedLanguage) => void;
  onDelete: (seed: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">Saved languages</h3>
        <div className="flex gap-2">
          <button
            onClick={onExport}
            disabled={saved.length === 0}
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            Export
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {saved.length === 0 ? (
        <p className="text-sm text-slate-500">No saved languages yet. Generate one and hit “Save”.</p>
      ) : (
        <ul className="space-y-1">
          {saved.map((s) => (
            <li
              key={s.seed}
              className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                s.seed === activeSeed ? 'bg-slate-800/80' : 'hover:bg-slate-800/40'
              }`}
            >
              <button onClick={() => onLoad(s)} className="flex flex-col text-left">
                <span className="font-conlang text-amber-200">
                  {s.name}
                  {s.overrides && <span className="ml-1.5 align-middle text-[10px] text-emerald-400">edited</span>}
                </span>
                <span className="font-mono text-xs text-slate-500">{s.seed}</span>
              </button>
              <button
                onClick={() => onDelete(s.seed)}
                className="text-xs text-slate-500 hover:text-red-400"
                aria-label={`Delete ${s.name}`}
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
