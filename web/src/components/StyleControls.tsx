import type { StyleOptions, WordLength } from '../../../src/shared/types';

const BRANCHES = ['German', 'Greek', 'Russian', 'Icelandic', 'Sanskrit', 'French'];

export function StyleControls({
  style,
  onChange,
}: {
  style: StyleOptions;
  onChange: (style: StyleOptions) => void;
}) {
  const harshness = style.harshness ?? 0.5;
  const complexity = style.complexity ?? 0.5;
  const generations = style.generations ?? 3;
  const wordLength = style.wordLength ?? 'medium';
  const branch = style.branch ?? '';

  const patch = (p: Partial<StyleOptions>) => onChange({ ...style, ...p });

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:grid-cols-2 lg:grid-cols-5">
      <label className="flex flex-col gap-1 text-sm text-slate-400">
        Branch bias
        <select
          value={branch}
          onChange={(e) => patch({ branch: e.target.value || undefined })}
          className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100 outline-none focus:border-amber-500"
        >
          <option value="">Auto (seed picks)</option>
          {BRANCHES.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-400">
        Word length
        <select
          value={wordLength}
          onChange={(e) => patch({ wordLength: e.target.value as WordLength })}
          className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100 outline-none focus:border-amber-500"
        >
          <option value="short">Short</option>
          <option value="medium">Medium</option>
          <option value="long">Long</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-400">
        Harshness: {harshness.toFixed(2)}
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={harshness}
          onChange={(e) => patch({ harshness: Number(e.target.value) })}
          className="accent-amber-500"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-400">
        Complexity: {complexity.toFixed(2)}
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={complexity}
          onChange={(e) => patch({ complexity: Number(e.target.value) })}
          className="accent-amber-500"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-400">
        Generations
        <input
          type="number"
          min={1}
          max={100}
          step={1}
          value={generations}
          onChange={(e) => {
            const n = Math.round(Number(e.target.value));
            if (Number.isFinite(n)) patch({ generations: Math.max(1, Math.min(100, n)) });
          }}
          className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100 outline-none focus:border-amber-500"
        />
      </label>
    </div>
  );
}
