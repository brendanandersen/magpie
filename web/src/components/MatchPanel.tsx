import { useEffect, useState } from 'react';
import type { SeedMatch, StyleOptions } from '../../../src/shared/types';
import { fetchMatchTargets, findSeeds } from '../api';

function styleSummary(style: StyleOptions): string {
  const parts: string[] = [];
  if (style.branch) parts.push(style.branch);
  if (typeof style.harshness === 'number') parts.push(`harsh ${style.harshness.toFixed(2)}`);
  if (typeof style.complexity === 'number') parts.push(`cplx ${style.complexity.toFixed(2)}`);
  return parts.length ? parts.join(' · ') : 'default style';
}

function Chips({ label, items, tone }: { label: string; items: string[]; tone: 'good' | 'bad' }) {
  if (items.length === 0) return null;
  const color = tone === 'good' ? 'bg-emerald-900/40 text-emerald-300' : 'bg-rose-900/30 text-rose-300';
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <span className="mr-1 text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      {items.map((p) => (
        <span key={p} className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${color}`}>
          {p}
        </span>
      ))}
    </div>
  );
}

export function MatchPanel({ onLoad }: { onLoad: (seed: string, style: StyleOptions) => void }) {
  const [targets, setTargets] = useState<string[]>([]);
  const [target, setTarget] = useState('');
  const [results, setResults] = useState<SeedMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMatchTargets()
      .then((ts) => {
        setTargets(ts.map((t) => t.name));
        setTarget((cur) => cur || ts[0]?.name || '');
      })
      .catch(() => setError('Could not load target languages.'));
  }, []);

  const onFind = async () => {
    if (!target) return;
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      setResults(await findSeeds(target));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">
          Match a real language
        </h3>
        <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-rose-300">
          experimental
        </span>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        A work in progress. This searches seeds and style knobs for the sound changes that best evolve the
        PIE roots toward a real modern language's actual words, falling back to
        sound/structure where reflex data is sparse. Real language descent is messy and heavily
        under-determined, so this <span className="text-slate-400">can&rsquo;t be done reliably</span> —
        treat the results as rough, playful approximations, not accurate reconstructions.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100 outline-none focus:border-amber-500"
        >
          {targets.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          onClick={onFind}
          disabled={loading || !target}
          className="rounded-lg bg-amber-500 px-4 py-1.5 font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {loading ? 'Searching…' : 'Find seeds'}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

      {results.length > 0 && (
        <ul className="mt-4 space-y-3">
          {results.map((m) => (
            <li key={m.seed} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-amber-300">{m.seed}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.round(m.score * 100)}%` }} />
                </div>
                <span className="w-10 shrink-0 text-right font-mono text-xs text-slate-400">
                  {Math.round(m.score * 100)}%
                </span>
                <button
                  onClick={() => onLoad(m.seed, m.style)}
                  className="shrink-0 rounded border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800"
                >
                  Load
                </button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
                <span>{styleSummary(m.style)}</span>
                {m.lexicalScore !== null && (
                  <span className="text-amber-300/80">
                    words {Math.round(m.lexicalScore * 100)}% ({m.lexicalCoverage})
                  </span>
                )}
                <span>phonemes {Math.round(m.phonemeScore * 100)}%</span>
                {m.typologyScore !== null && <span>grammar {Math.round(m.typologyScore * 100)}%</span>}
                <span>syllables {Math.round(m.phonotacticsScore * 100)}%</span>
              </div>
              {m.examples.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {m.examples.slice(0, 8).map((e) => (
                    <span
                      key={e.concept}
                      title={e.concept}
                      className="rounded bg-slate-800/70 px-1.5 py-0.5 font-mono text-[11px] text-slate-300"
                    >
                      {e.ours} <span className="text-slate-500">~</span>{' '}
                      <span className="text-amber-300/90">{e.real}</span>
                    </span>
                  ))}
                </div>
              )}
              <Chips label="matched" items={m.matched} tone="good" />
              <Chips label="missing" items={m.missing} tone="bad" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
