import type {
  LanguageDefinition,
  StyleOptions,
  TranslationResult,
  ReverseResult,
} from '../../../src/shared/types';
import type { Direction } from '../components/TranslatorPanel';
import { LanguagePanel } from '../components/LanguagePanel';
import { TranslatorPanel } from '../components/TranslatorPanel';
import { DnaPanel } from '../components/DnaPanel';
import { CURATED_VOICES } from '../piper';

export interface LanguagePageProps {
  language: LanguageDefinition;
  style: StyleOptions;
  ipa: boolean;
  onIpaChange: (ipa: boolean) => void;
  speechReady: boolean;
  voicePct: number;
  manualVoice: string;
  onVoiceChange: (voice: string) => void;
  direction: Direction;
  onDirectionChange: (direction: Direction) => void;
  translation: TranslationResult | null;
  reverse: ReverseResult | null;
  translating: boolean;
  onTranslate: (sentence: string) => void;
  onSave: () => void;
  onCopyLink: () => void;
  copied: boolean;
  onBack: () => void;
  error: string | null;
}

function styleSummary(style: StyleOptions): string {
  const parts: string[] = [];
  if (style.branch) parts.push(style.branch);
  if (typeof style.harshness === 'number') parts.push(`harsh ${style.harshness.toFixed(2)}`);
  if (typeof style.complexity === 'number') parts.push(`cplx ${style.complexity.toFixed(2)}`);
  if (style.wordLength) parts.push(style.wordLength);
  return parts.length ? parts.join(' · ') : 'default style';
}

export function LanguagePage(props: LanguagePageProps) {
  const {
    language,
    style,
    ipa,
    onIpaChange,
    speechReady,
    voicePct,
    manualVoice,
    onVoiceChange,
    direction,
    onDirectionChange,
    translation,
    reverse,
    translating,
    onTranslate,
    onSave,
    onCopyLink,
    copied,
    onBack,
    error,
  } = props;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <button onClick={onBack} className="text-sm text-slate-400 hover:text-amber-300">
          ← Customize sound changes
        </button>
      </div>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-conlang text-4xl font-bold text-amber-300">{language.name}</h1>
          <p className="text-sm text-slate-500">
            seed <span className="font-mono text-slate-400">{language.seed}</span> · {styleSummary(style)} · from{' '}
            {language.inventory.inspiredBy}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input type="checkbox" checked={ipa} onChange={(e) => onIpaChange(e.target.checked)} />
            show IPA
          </label>
          <button
            onClick={onSave}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
          >
            Save
          </button>
          <button
            onClick={onCopyLink}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
          >
            {copied ? 'Link copied!' : 'Copy share link'}
          </button>
        </div>
      </header>

      {error && <div className="mb-6 rounded-lg border border-red-800 bg-red-950/50 p-3 text-red-300">{error}</div>}

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-sm">
        <label className="text-slate-400">Voice</label>
        <select
          value={manualVoice}
          onChange={(e) => onVoiceChange(e.target.value)}
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100 outline-none focus:border-amber-500"
        >
          <option value="">Auto — matches {language.inventory.inspiredBy}</option>
          {CURATED_VOICES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
        <span className="text-slate-500">{speechReady ? 'voice ready' : `loading voice… ${voicePct}%`}</span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <LanguagePanel language={language} ipa={ipa} speechReady={speechReady} />
          <DnaPanel language={language} />
        </div>
        <div className="flex flex-col gap-6">
          <TranslatorPanel
            languageName={language.name}
            direction={direction}
            onDirectionChange={onDirectionChange}
            translation={translation}
            reverse={reverse}
            ipa={ipa}
            loading={translating}
            onTranslate={onTranslate}
            speechReady={speechReady}
          />
        </div>
      </div>

      <footer className="mt-10 text-center text-xs text-slate-600">
        Built with the Etymology Atlas dataset · runs fully locally
      </footer>
    </div>
  );
}
