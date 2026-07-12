import { useCallback, useEffect, useState } from 'react';
import type {
  LanguageDefinition,
  TranslationResult,
  ReverseResult,
  StyleOptions,
  LanguageOverrides,
  SoundChangeRule,
} from '../../src/shared/types';
import type { SavedLanguage } from '../../src/shared/saved';
import {
  generateLanguage,
  generateWithOverrides,
  generateGeneration,
  translateSentence,
  reverseSentence,
  randomSeed,
} from './api';
import type { Direction } from './components/TranslatorPanel';
import {
  deleteLanguage,
  exportSaved,
  importSaved,
  loadSaved,
  saveLanguage,
  seedFromUrl,
  styleFromUrl,
  overridesFromUrl,
  shareLink,
  syncSeedToUrl,
} from './storage';
import { seedChosenStyle } from './style';
import { GeneratePage } from './pages/GeneratePage';
import { CustomizePage } from './pages/CustomizePage';
import { LanguagePage } from './pages/LanguagePage';
import { navigate, useHashRoute } from './router';
import { setPiperVoice, voiceForBranch, currentVoice, isPiperReady } from './piper';

function hasOverrides(o: LanguageOverrides): boolean {
  return o.soundChangeRules !== undefined || o.consonants !== undefined || o.vowels !== undefined;
}

export function App() {
  const initialSeed = seedFromUrl() ?? 'magpie';
  const initialStyle = styleFromUrl();
  const initialOverrides = overridesFromUrl();
  const [seedInput, setSeedInput] = useState(initialSeed);
  const [activeSeed, setActiveSeed] = useState(initialSeed);
  const [style, setStyle] = useState<StyleOptions>(initialStyle);
  const [baseLanguage, setBaseLanguage] = useState<LanguageDefinition | null>(null);
  const [language, setLanguage] = useState<LanguageDefinition | null>(null);
  const [overrides, setOverrides] = useState<LanguageOverrides>({});
  const [addingGeneration, setAddingGeneration] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [speechReady, setSpeechReady] = useState(false);
  const [voicePct, setVoicePct] = useState(0);
  const [manualVoice, setManualVoice] = useState<string>(() => {
    try {
      return localStorage.getItem('magpie.voice') ?? '';
    } catch {
      return '';
    }
  });
  const [translation, setTranslation] = useState<TranslationResult | null>(null);
  const [reverse, setReverse] = useState<ReverseResult | null>(null);
  const [direction, setDirection] = useState<Direction>('forward');
  const [ipa, setIpa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedLanguage[]>([]);
  const [copied, setCopied] = useState(false);
  const route = useHashRoute();

  const loadLanguage = useCallback(
    async (seed: string, styleOpts: StyleOptions, overrideOpts?: LanguageOverrides): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const base = await generateLanguage(seed, styleOpts);
        const next = overrideOpts && hasOverrides(overrideOpts) ? overrideOpts : {};
        const active = hasOverrides(next) ? await generateWithOverrides(seed, styleOpts, next) : base;
        setBaseLanguage(base);
        setLanguage(active);
        setOverrides(next);
        setActiveSeed(seed);
        setTranslation(null);
        setReverse(null);
        syncSeedToUrl(seed, styleOpts, next);
        return true;
      } catch (e) {
        setError((e as Error).message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /** Load a language and, on success, advance to the customization step. */
  const openForCustomize = useCallback(
    async (seed: string, styleOpts: StyleOptions, overrideOpts?: LanguageOverrides) => {
      if (await loadLanguage(seed, styleOpts, overrideOpts)) navigate('customize');
    },
    [loadLanguage],
  );

  useEffect(() => {
    setSaved(loadSaved());
    void loadLanguage(initialSeed, initialStyle, initialOverrides);
    // initial seed/style/overrides captured once at mount on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadLanguage]);

  // Load (and auto-download) the appropriate voice: manual override, else matched to
  // the language's inspiring branch. Re-runs when the language or override changes.
  useEffect(() => {
    if (!language) return;
    const voice = manualVoice || voiceForBranch(language.inventory.inspiredBy);
    if (voice === currentVoice() && isPiperReady()) {
      setSpeechReady(true);
      return;
    }
    setSpeechReady(false);
    setVoicePct(0);
    setPiperVoice(voice, (loaded, total) => {
      if (total) setVoicePct(Math.min(100, Math.round((loaded / total) * 100)));
    })
      .then((session) => setSpeechReady(!!session))
      .catch(() => setSpeechReady(false));
  }, [language, manualVoice]);

  const onVoiceChange = (voice: string) => {
    setManualVoice(voice);
    try {
      if (voice) localStorage.setItem('magpie.voice', voice);
      else localStorage.removeItem('magpie.voice');
    } catch {
      // ignore storage failures
    }
  };

  const onTranslate = useCallback(
    async (sentence: string) => {
      setTranslating(true);
      setError(null);
      try {
        if (direction === 'forward') {
          setTranslation(await translateSentence(activeSeed, sentence, style, overrides));
        } else {
          setReverse(await reverseSentence(activeSeed, sentence, style, overrides));
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setTranslating(false);
      }
    },
    [activeSeed, direction, style, overrides],
  );

  const onOverridesChange = async (next: LanguageOverrides) => {
    setOverrides(next);
    if (!baseLanguage) return;
    syncSeedToUrl(activeSeed, style, next);
    if (!hasOverrides(next)) {
      setLanguage(baseLanguage);
      return;
    }
    setPreviewing(true);
    try {
      setLanguage(await generateWithOverrides(activeSeed, style, next));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPreviewing(false);
    }
  };

  const onRulesChange = (rules: SoundChangeRule[]) =>
    void onOverridesChange({ ...overrides, soundChangeRules: rules });
  const onConsonantsChange = (list: string[]) => void onOverridesChange({ ...overrides, consonants: list });
  const onVowelsChange = (list: string[]) => void onOverridesChange({ ...overrides, vowels: list });
  const onResetOverrides = () => void onOverridesChange({});

  /** Append a fresh, plausible generation of rules to the current set. */
  const onAddGeneration = async () => {
    if (!baseLanguage) return;
    const current = overrides.soundChangeRules ?? baseLanguage.soundChangeRules;
    const maxGen = current.reduce((m, r) => Math.max(m, r.generation ?? 0), 0);
    setAddingGeneration(true);
    setError(null);
    try {
      const fresh = await generateGeneration(activeSeed, maxGen + 1, style);
      await onOverridesChange({ ...overrides, soundChangeRules: [...current, ...fresh] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAddingGeneration(false);
    }
  };

  // Typing a seed or randomizing is not a match selection, so it must not inherit a
  // previously matched branch (which would carry that branch's anchored sound laws).
  const onGenerate = () => {
    const next = seedChosenStyle(style);
    setStyle(next);
    void openForCustomize(seedInput, next);
  };

  /** Regenerate the active language in place when style knobs change (resets overrides). */
  const onStyleChange = (next: StyleOptions) => {
    setStyle(next);
    void loadLanguage(activeSeed, next);
  };

  const onRandom = () => {
    const seed = randomSeed();
    const next = seedChosenStyle(style);
    setSeedInput(seed);
    setStyle(next);
    void openForCustomize(seed, next);
  };

  const onLoadMatch = (seed: string, matchStyle: StyleOptions) => {
    setSeedInput(seed);
    setStyle(matchStyle);
    void openForCustomize(seed, matchStyle);
  };

  const onSave = () => {
    if (language) {
      setSaved(saveLanguage(language.seed, language.name, style, hasOverrides(overrides) ? overrides : undefined));
    }
  };

  const onDeleteSaved = (seed: string) => setSaved(deleteLanguage(seed));

  const onLoadSaved = (entry: SavedLanguage) => {
    const nextStyle = entry.style ?? {};
    setSeedInput(entry.seed);
    setStyle(nextStyle);
    void openForCustomize(entry.seed, nextStyle, entry.overrides);
  };

  const onImport = async (file: File) => {
    try {
      setSaved(await importSaved(file));
    } catch (e) {
      setError(`Import failed: ${(e as Error).message}`);
    }
  };

  const onCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink(activeSeed, style, hasOverrides(overrides) ? overrides : undefined));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Could not copy link to clipboard');
    }
  };

  if (route === 'language' && language) {
    return (
      <LanguagePage
        language={language}
        style={style}
        ipa={ipa}
        onIpaChange={setIpa}
        speechReady={speechReady}
        voicePct={voicePct}
        manualVoice={manualVoice}
        onVoiceChange={onVoiceChange}
        direction={direction}
        onDirectionChange={setDirection}
        translation={translation}
        reverse={reverse}
        translating={translating}
        onTranslate={onTranslate}
        onSave={onSave}
        onCopyLink={onCopyLink}
        copied={copied}
        onBack={() => navigate('customize')}
        error={error}
      />
    );
  }

  if (route === 'customize' && baseLanguage && language) {
    return (
      <CustomizePage
        language={language}
        baseLanguage={baseLanguage}
        overrides={overrides}
        style={style}
        onStyleChange={onStyleChange}
        edited={hasOverrides(overrides)}
        ipa={ipa}
        onIpaChange={setIpa}
        onRulesChange={onRulesChange}
        onConsonantsChange={onConsonantsChange}
        onVowelsChange={onVowelsChange}
        onReset={onResetOverrides}
        onAddGeneration={onAddGeneration}
        addingGeneration={addingGeneration}
        previewing={previewing}
        onOpen={() => navigate('language')}
        onBack={() => navigate('generate')}
        error={error}
      />
    );
  }

  if ((route === 'language' || route === 'customize') && loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">Conjuring language…</div>
    );
  }

  return (
    <GeneratePage
      seedInput={seedInput}
      onSeedInput={setSeedInput}
      onGenerate={onGenerate}
      onRandom={onRandom}
      loading={loading}
      onLoadMatch={onLoadMatch}
      language={language}
      onContinue={() => navigate('customize')}
      saved={saved}
      activeSeed={activeSeed}
      onLoadSaved={onLoadSaved}
      onDeleteSaved={onDeleteSaved}
      onExport={exportSaved}
      onImport={onImport}
      error={error}
    />
  );
}
