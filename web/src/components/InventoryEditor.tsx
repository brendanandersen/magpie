import { useState } from 'react';

export interface InventoryEditorProps {
  consonants: string[];
  vowels: string[];
  onConsonants: (list: string[]) => void;
  onVowels: (list: string[]) => void;
}

export function InventoryEditor({ consonants, vowels, onConsonants, onVowels }: InventoryEditorProps) {
  const [newCons, setNewCons] = useState('');
  const [newVowel, setNewVowel] = useState('');

  const add = (list: string[], seg: string, apply: (l: string[]) => void) => {
    const s = seg.trim().toLowerCase();
    if (!s || list.includes(s)) return;
    apply([...list, s]);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <PhonemeEditor
        label="Consonants"
        segments={consonants}
        value={newCons}
        setValue={setNewCons}
        onAdd={() => {
          add(consonants, newCons, onConsonants);
          setNewCons('');
        }}
        onRemove={(s) => onConsonants(consonants.filter((c) => c !== s))}
      />
      <PhonemeEditor
        label="Vowels"
        segments={vowels}
        value={newVowel}
        setValue={setNewVowel}
        onAdd={() => {
          add(vowels, newVowel, onVowels);
          setNewVowel('');
        }}
        onRemove={(s) => onVowels(vowels.filter((v) => v !== s))}
      />
    </div>
  );
}

function PhonemeEditor({
  label,
  segments,
  value,
  setValue,
  onAdd,
  onRemove,
}: {
  label: string;
  segments: string[];
  value: string;
  setValue: (v: string) => void;
  onAdd: () => void;
  onRemove: (seg: string) => void;
}) {
  return (
    <div className="mt-3 first:mt-0">
      <div className="mb-2 text-sm text-slate-400">{label} (click × to remove):</div>
      <div className="flex flex-wrap items-center gap-1.5">
        {segments.map((s) => (
          <span key={s} className="rounded-md bg-slate-800 px-2 py-0.5 font-mono text-sm text-slate-200">
            {s}
            <button onClick={() => onRemove(s)} className="ml-1.5 text-slate-500 hover:text-red-300">
              ×
            </button>
          </span>
        ))}
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAdd()}
          placeholder="+"
          className="w-14 rounded border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-sm text-slate-100 outline-none focus:border-amber-500"
        />
      </div>
    </div>
  );
}
