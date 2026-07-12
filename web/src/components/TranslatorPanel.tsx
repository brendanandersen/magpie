import { useState } from 'react';
import type { ReactNode } from 'react';
import type { ReverseResult, TranslatedToken, TranslationResult } from '../../../src/shared/types';
import { speak } from '../speech';

export type Direction = 'forward' | 'reverse';

function OriginBadge({ origin }: { origin?: 'traced' | 'coined' }) {
  if (!origin) return null;
  const traced = origin === 'traced';
  return (
    <span
      className={`ml-2 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
        traced ? 'bg-emerald-900/60 text-emerald-300' : 'bg-fuchsia-900/60 text-fuchsia-300'
      }`}
    >
      {origin}
    </span>
  );
}

function WordGloss({ token, ipa }: { token: TranslatedToken; ipa: boolean }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <div className="flex items-baseline">
        <span className="text-slate-400">{token.surface}</span>
        <span className="mx-2 text-slate-600">→</span>
        <span className="font-conlang text-lg text-amber-200">{ipa ? `/${token.ipa}/` : token.roman}</span>
        <OriginBadge origin={token.origin} />
      </div>
      {token.origin === 'traced' && (
        <div className="mt-1 text-xs text-slate-400">
          from <span className="text-slate-300">{token.ancestorLang}</span>{' '}
          <span className="font-mono text-slate-200">{token.ancestorForm}</span>
        </div>
      )}
      {token.derivation && token.derivation.length > 0 && (
        <div className="mt-1 font-mono text-xs text-slate-500">
          {token.derivation.map((d, i) => (
            <span key={i}>
              {d.before}→{d.after}
              {i < token.derivation!.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DirButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1 text-sm ${active ? 'bg-amber-500 font-semibold text-slate-950' : 'border border-slate-700 text-slate-300 hover:bg-slate-800'}`}
    >
      {children}
    </button>
  );
}

export function TranslatorPanel({
  languageName,
  direction,
  onDirectionChange,
  translation,
  reverse,
  ipa,
  loading,
  onTranslate,
  speechReady,
}: {
  languageName: string;
  direction: Direction;
  onDirectionChange: (d: Direction) => void;
  translation: TranslationResult | null;
  reverse: ReverseResult | null;
  ipa: boolean;
  loading: boolean;
  onTranslate: (sentence: string) => void;
  speechReady: boolean;
}) {
  const [sentence, setSentence] = useState('The mother gave cold water to the brothers');
  const [showGloss, setShowGloss] = useState(true);
  const forward = direction === 'forward';

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">Translate</h3>
        <div className="flex gap-2">
          <DirButton active={forward} onClick={() => onDirectionChange('forward')}>
            English → {languageName}
          </DirButton>
          <DirButton active={!forward} onClick={() => onDirectionChange('reverse')}>
            {languageName} → English
          </DirButton>
        </div>
      </div>

      <textarea
        value={sentence}
        onChange={(e) => setSentence(e.target.value)}
        rows={3}
        className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 p-3 text-slate-100 outline-none focus:border-amber-500"
        placeholder={forward ? 'Type an English sentence...' : `Type a sentence in ${languageName}...`}
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => onTranslate(sentence)}
          disabled={loading}
          className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {loading ? 'Translating…' : 'Translate'}
        </button>
        {forward && (
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input type="checkbox" checked={showGloss} onChange={(e) => setShowGloss(e.target.checked)} />
            show origins
          </label>
        )}
      </div>

      {forward && translation && (
        <div className="mt-5">
          <div className="rounded-xl border border-amber-500/20 bg-slate-950 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="font-conlang text-2xl leading-relaxed text-amber-200">
                {ipa ? translation.outputIpa : translation.output}
              </div>
              <button
                onClick={() => speak(translation.output)}
                disabled={!speechReady}
                title={speechReady ? 'Hear it' : 'Loading voice…'}
                className="shrink-0 rounded-lg border border-slate-700 px-2 py-1 text-sm text-slate-300 hover:bg-slate-800 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
              >
                {speechReady ? '▶ speak' : 'voice…'}
              </button>
            </div>
            <div className="mt-1 text-xs text-slate-500">word order: {translation.wordOrder} (unapplied — see notes)</div>
          </div>

          {showGloss && (
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {translation.tokens
                .filter((t) => t.isWord)
                .map((t, i) => (
                  <WordGloss key={`${t.surface}-${i}`} token={t} ipa={ipa} />
                ))}
            </div>
          )}
        </div>
      )}

      {!forward && reverse && (
        <div className="mt-5">
          <div className="rounded-xl border border-amber-500/20 bg-slate-950 p-4">
            <div className="text-2xl leading-relaxed text-slate-100">{reverse.output}</div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {reverse.tokens
              .filter((t) => t.isWord)
              .map((t, i) => (
                <span
                  key={`${t.surface}-${i}`}
                  title={t.notes.join('; ')}
                  className={`rounded-lg border px-2 py-1 text-sm ${
                    t.notes.includes('unknown word')
                      ? 'border-red-800/60 text-red-300'
                      : t.approx
                        ? 'border-amber-700/60 text-amber-200'
                        : 'border-slate-700 text-slate-200'
                  }`}
                >
                  <span className="font-conlang">{t.surface}</span>
                  <span className="mx-1 text-slate-600">→</span>
                  {t.english}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
