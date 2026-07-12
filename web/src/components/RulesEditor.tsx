import { useEffect, useRef, useState } from 'react';
import type { SoundChangeRule } from '../../../src/shared/types';
import { groupAnchorInfo, anchorPhaseLabel } from './anchors';

type Env = SoundChangeRule['env'];

const ENV_OPTIONS: { value: Env; label: string }[] = [
  { value: 'any', label: 'anywhere' },
  { value: 'initial', label: 'word-initial' },
  { value: 'final', label: 'word-final' },
  { value: 'intervocalic', label: 'between vowels' },
  { value: 'before_front', label: 'before front vowel' },
];

function describe(from: string, to: string, env: Env): string {
  const core = `${from || '∅'} → ${to || '∅'}`;
  const suffix = ENV_OPTIONS.find((e) => e.value === env)?.label;
  return env === 'any' ? core : `${core} / ${suffix}`;
}

interface Group {
  rules: SoundChangeRule[];
}

/** Group consecutive rules by their generation tag, preserving order. */
function deriveGroups(rules: SoundChangeRule[]): Group[] {
  const groups: Group[] = [];
  let lastGen: number | undefined;
  for (const rule of rules) {
    const gen = rule.generation ?? 0;
    if (groups.length === 0 || gen !== lastGen) {
      groups.push({ rules: [rule] });
      lastGen = gen;
    } else {
      groups[groups.length - 1].rules.push(rule);
    }
  }
  return groups;
}

function signature(rules: SoundChangeRule[]): string {
  return rules.map((r) => `${r.id}:${r.from}>${r.to}:${r.env}:${r.generation ?? 0}`).join('|');
}

let uid = 0;
function customRule(): SoundChangeRule {
  uid += 1;
  return { id: `custom_${Date.now()}_${uid}`, description: '∅ → ∅', from: '', to: '', env: 'any' };
}

export interface RulesEditorProps {
  /** Effective current rule list (overrides applied, else generated defaults). */
  rules: SoundChangeRule[];
  /** True when the current rules differ from the generated defaults. */
  edited: boolean;
  onChange: (rules: SoundChangeRule[]) => void;
  onReset: () => void;
  onAddGeneration: () => void;
  addingGeneration: boolean;
}

export function RulesEditor({
  rules,
  edited,
  onChange,
  onReset,
  onAddGeneration,
  addingGeneration,
}: RulesEditorProps) {
  const [groups, setGroups] = useState<Group[]>(() => deriveGroups(rules));
  const lastEmitted = useRef<string>(signature(rules));
  const drag = useRef<{ g: number; r: number } | null>(null);
  const dragGen = useRef<number | null>(null);

  // Re-sync from props only when the change came from outside this editor
  // (add-generation, reset, or a freshly loaded language) — never echo our own edits.
  useEffect(() => {
    const sig = signature(rules);
    if (sig !== lastEmitted.current) {
      setGroups(deriveGroups(rules));
      lastEmitted.current = sig;
    }
  }, [rules]);

  /** Persist edits: re-tag generations by position, drop incomplete (empty-from) rules. */
  const commit = (next: Group[]) => {
    setGroups(next);
    const flat = next.flatMap((group, gi) =>
      group.rules
        .filter((r) => r.from.trim() !== '')
        .map((r) => ({ ...r, generation: gi + 1, description: describe(r.from, r.to, r.env) })),
    );
    lastEmitted.current = signature(flat);
    onChange(flat);
  };

  const patchRule = (gi: number, ri: number, patch: Partial<SoundChangeRule>) => {
    const next = groups.map((g) => ({ rules: [...g.rules] }));
    next[gi].rules[ri] = { ...next[gi].rules[ri], ...patch };
    commit(next);
  };

  const removeRule = (gi: number, ri: number) => {
    const next = groups.map((g) => ({ rules: [...g.rules] }));
    next[gi].rules.splice(ri, 1);
    if (next[gi].rules.length === 0) next.splice(gi, 1);
    commit(next);
  };

  const addRule = (gi: number) => {
    const next = groups.map((g) => ({ rules: [...g.rules] }));
    next[gi].rules.push(customRule());
    setGroups(next); // local only until the user fills in `from` (commit filters empties)
  };

  const removeGeneration = (gi: number) => {
    const next = groups.filter((_, i) => i !== gi);
    commit(next);
  };

  const moveRule = (toG: number, toR: number) => {
    const from = drag.current;
    drag.current = null;
    if (!from) return;
    const next = groups.map((g) => ({ rules: [...g.rules] }));
    const [moved] = next[from.g].rules.splice(from.r, 1);
    if (!moved) return;
    // account for removal shifting indices within the same group
    let insertAt = toR;
    if (from.g === toG && from.r < toR) insertAt -= 1;
    next[toG].rules.splice(insertAt, 0, moved);
    if (next[from.g].rules.length === 0) next.splice(from.g, 1);
    commit(next);
  };

  const moveGen = (toG: number) => {
    const from = dragGen.current;
    dragGen.current = null;
    if (from === null || from === toG) return;
    const next = [...groups];
    const [moved] = next.splice(from, 1);
    next.splice(toG, 0, moved);
    commit(next);
  };

  const totalRules = groups.reduce((n, g) => n + g.rules.filter((r) => r.from.trim()).length, 0);
  // Number only the generative generations (anchor groups are labelled separately).
  let generativeSeen = 0;
  const genNumbers = groups.map((g) => (groupAnchorInfo(g.rules) ? null : (generativeSeen += 1)));
  const generativeCount = generativeSeen;
  const anchorBranch = groups.map((g) => groupAnchorInfo(g.rules)?.branch).find(Boolean);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-slate-400">
          <span className="font-semibold text-slate-200">{totalRules}</span> sound change
          {totalRules === 1 ? '' : 's'} across{' '}
          <span className="font-semibold text-slate-200">{generativeCount}</span>{' '}
          generation{generativeCount === 1 ? '' : 's'}
          {anchorBranch ? (
            <>
              {' + '}
              <span className="font-semibold text-sky-300">{anchorBranch}</span> anchors
            </>
          ) : null}
        </div>
        <button
          onClick={onReset}
          disabled={!edited}
          className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
        >
          Reset to generated
        </button>
      </div>

      {anchorBranch ? (
        <p className="mb-4 -mt-1 text-xs text-slate-500">
          <span className="text-sky-300">⚓ anchored</span> rules are {anchorBranch}&rsquo;s defining historical sound
          laws, applied to every seed on this branch to keep it recognizably {anchorBranch}. You can still edit them.
        </p>
      ) : null}

      <div className="space-y-4">
        {groups.map((group, gi) => {
          const anchor = groupAnchorInfo(group.rules);
          return (
          <div
            key={gi}
            className={`rounded-xl border ${anchor ? 'border-sky-800/60' : 'border-slate-800'} bg-slate-950/40`}
            onDragOver={(e) => {
              if (dragGen.current !== null) e.preventDefault();
            }}
            onDrop={() => {
              if (dragGen.current !== null) moveGen(gi);
            }}
          >
            <div
              draggable
              onDragStart={() => (dragGen.current = gi)}
              className="flex cursor-grab items-center justify-between border-b border-slate-800 px-3 py-2 active:cursor-grabbing"
            >
              <div className="flex items-center gap-2">
                <span className="select-none text-slate-600">⠿</span>
                {anchor ? (
                  <>
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-sky-300"
                      title={`${anchor.branch}'s defining historical sound laws — applied to every seed on this branch`}
                    >
                      ⚓ anchored
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-widest text-sky-300/90">
                      {anchor.branch} · {anchorPhaseLabel(anchor.phase)}
                    </span>
                  </>
                ) : (
                  <span className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">
                    Generation {genNumbers[gi]}
                  </span>
                )}
                <span className="text-xs text-slate-600">
                  {group.rules.length} rule{group.rules.length === 1 ? '' : 's'}
                </span>
              </div>
              <button
                onClick={() => removeGeneration(gi)}
                className="text-xs text-slate-500 hover:text-red-400"
                title="Remove this generation"
              >
                remove generation
              </button>
            </div>

            <ul className="divide-y divide-slate-800/60">
              {group.rules.map((rule, ri) => (
                <li
                  key={rule.id}
                  draggable
                  onDragStart={(e) => {
                    e.stopPropagation();
                    drag.current = { g: gi, r: ri };
                  }}
                  onDragOver={(e) => {
                    if (drag.current) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.stopPropagation();
                    if (drag.current) moveRule(gi, ri);
                  }}
                  className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
                >
                  <span className="cursor-grab select-none text-slate-600 active:cursor-grabbing">⠿</span>
                  <input
                    value={rule.from}
                    onChange={(e) => patchRule(gi, ri, { from: e.target.value })}
                    placeholder="from"
                    className="w-16 rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-slate-100 outline-none focus:border-amber-500"
                  />
                  <span className="text-slate-500">→</span>
                  <input
                    value={rule.to}
                    onChange={(e) => patchRule(gi, ri, { to: e.target.value })}
                    placeholder="∅"
                    className="w-16 rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-slate-100 outline-none focus:border-amber-500"
                  />
                  <select
                    value={rule.env}
                    onChange={(e) => patchRule(gi, ri, { env: e.target.value as Env })}
                    className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100 outline-none focus:border-amber-500"
                  >
                    {ENV_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {rule.law && (
                    <span
                      title={rule.law}
                      className="max-w-[14rem] truncate text-xs italic text-sky-300/70"
                    >
                      {rule.law}
                    </span>
                  )}
                  <button
                    onClick={() => removeRule(gi, ri)}
                    className="ml-auto text-slate-500 hover:text-red-400"
                    title="Remove rule"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>

            <div className="px-3 py-2">
              <button
                onClick={() => addRule(gi)}
                className="rounded border border-dashed border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800"
              >
                + add rule
              </button>
            </div>
          </div>
          );
        })}
      </div>

      <button
        onClick={onAddGeneration}
        disabled={addingGeneration}
        className="mt-4 w-full rounded-xl border border-dashed border-amber-500/40 py-2 text-sm text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
      >
        {addingGeneration ? 'Adding…' : '+ add generation'}
      </button>
    </div>
  );
}
