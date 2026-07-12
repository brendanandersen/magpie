import type {
  LanguageDefinition,
  LanguageOverrides,
  SoundChangeRule,
  StyleOptions,
} from '../../../src/shared/types';
import { RulesEditor } from '../components/RulesEditor';
import { InventoryEditor } from '../components/InventoryEditor';
import { StyleControls } from '../components/StyleControls';

export interface CustomizePageProps {
  language: LanguageDefinition;
  baseLanguage: LanguageDefinition;
  overrides: LanguageOverrides;
  style: StyleOptions;
  onStyleChange: (style: StyleOptions) => void;
  edited: boolean;
  ipa: boolean;
  onIpaChange: (ipa: boolean) => void;
  onRulesChange: (rules: SoundChangeRule[]) => void;
  onConsonantsChange: (list: string[]) => void;
  onVowelsChange: (list: string[]) => void;
  onReset: () => void;
  onAddGeneration: () => void;
  addingGeneration: boolean;
  previewing: boolean;
  onOpen: () => void;
  onBack: () => void;
  error: string | null;
}

const PREVIEW_CONCEPTS = [
  'water', 'mother', 'father', 'brother', 'fire', 'night', 'star',
  'three', 'name', 'heart', 'tooth', 'foot',
];

export function CustomizePage(props: CustomizePageProps) {
  const {
    language,
    baseLanguage,
    overrides,
    style,
    onStyleChange,
    edited,
    ipa,
    onIpaChange,
    onRulesChange,
    onConsonantsChange,
    onVowelsChange,
    onReset,
    onAddGeneration,
    addingGeneration,
    previewing,
    onOpen,
    onBack,
    error,
  } = props;

  const rules = overrides.soundChangeRules ?? baseLanguage.soundChangeRules;
  const consonants = overrides.consonants ?? baseLanguage.inventory.consonants;
  const vowels = overrides.vowels ?? baseLanguage.inventory.vowels;

  const byConcept = new Map(language.lexicon.map((w) => [w.english, w]));
  const preview = PREVIEW_CONCEPTS.map((c) => byConcept.get(c)).filter(Boolean).slice(0, 10);
  const sample = preview.length >= 6 ? preview : language.lexicon.slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-slate-400 hover:text-amber-300">
          ← Change seed
        </button>
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <input type="checkbox" checked={ipa} onChange={(e) => onIpaChange(e.target.checked)} />
          show IPA
        </label>
      </div>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-400/80">
            Step 2 · Sound changes
          </div>
          <h1 className="font-conlang text-4xl font-bold text-amber-300">{language.name}</h1>
          <p className="text-sm text-slate-500">
            seed <span className="font-mono text-slate-400">{language.seed}</span> · from{' '}
            {language.inventory.inspiredBy}. Shape the phonetic evolution, then open your language.
          </p>
        </div>
        <button
          onClick={onOpen}
          className="rounded-lg bg-amber-500 px-5 py-2.5 font-semibold text-slate-950 hover:bg-amber-400"
        >
          Open language →
        </button>
      </header>

      {error && <div className="mb-6 rounded-lg border border-red-800 bg-red-950/50 p-3 text-red-300">{error}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-slate-400">Shape</h2>
            <p className="mb-3 text-sm text-slate-500">
              Nudge the branch bias, harshness, complexity, word length, and number of generations. Changing these
              regenerates the language from the seed and resets manual rule edits.
            </p>
            <StyleControls style={style} onChange={onStyleChange} />
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-slate-400">
              Generations of sound change
            </h2>
            <p className="mb-3 text-sm text-slate-500">
              Each generation is a wave of regular sound changes applied in order. Edit any rule, add or remove
              rules, drag to reorder, or add and remove whole generations.
            </p>
            <RulesEditor
              rules={rules}
              edited={edited}
              onChange={onRulesChange}
              onReset={onReset}
              onAddGeneration={onAddGeneration}
              addingGeneration={addingGeneration}
            />
          </section>

          <details className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-widest text-slate-400">
              Advanced · phoneme inventory
            </summary>
            <p className="mb-3 mt-2 text-sm text-slate-500">
              Add or remove the consonants and vowels the language is allowed to use.
            </p>
            <InventoryEditor
              consonants={consonants}
              vowels={vowels}
              onConsonants={onConsonantsChange}
              onVowels={onVowelsChange}
            />
          </details>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">Live preview</h3>
              {previewing && <span className="text-xs text-slate-500">updating…</span>}
            </div>
            <ul className="space-y-1.5">
              {sample.map((w) => (
                <li key={w!.english} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-slate-500">{w!.english}</span>
                  <span className="font-conlang text-amber-200">{ipa ? `/${w!.ipa}/` : w!.roman}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
