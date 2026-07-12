/**
 * Piper (VITS) neural text-to-speech in the browser via @mintplex-labs/piper-tts-web
 * (ONNX Runtime Web). The voice model is fetched from HuggingFace on first use and
 * cached in the Origin Private File System; ORT/phonemizer WASM load from CDN. A
 * single reusable TtsSession is kept for fast repeat synthesis. All calls degrade to
 * `false` on failure so the caller can fall back to the Web Speech API.
 *
 * Piper accepts plain text (not IPA); it phonemizes with the voice's language rules,
 * so our romanized output is read by a natural English voice rather than rendered
 * from the generated IPA. Naturalness over phoneme-exactness, by design.
 */

import { TtsSession, type VoiceId } from '@mintplex-labs/piper-tts-web';

export const DEFAULT_VOICE = 'en_US-amy-low';

// The library defaults the ONNX Runtime wasm base to cdnjs @1.18.0, which lacks the
// `.jsep.mjs` worker that the bundled onnxruntime-web (1.27.0) requests -> 404. Point
// it at the jsDelivr npm mirror for the matching version. The phonemizer wasm/data
// keep the library's defaults.
const ONNX_WASM_BASE = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';
const PIPER_WASM_BASE = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize';
const WASM_PATHS = {
  onnxWasm: ONNX_WASM_BASE,
  piperData: `${PIPER_WASM_BASE}.data`,
  piperWasm: `${PIPER_WASM_BASE}.wasm`,
};

/**
 * Map a phoneme-inventory source ("inspired by") to a fitting Piper voice/accent.
 * Only voices with a 256-symbol table are usable: the wasm phonemizer emits ids from a
 * fixed per-language map, and 130-symbol community voices (Greek `rapunzelina`, all
 * Icelandic speakers) overflow their embedding table (Gather out-of-bounds → silence),
 * so those branches fall back to the default English voice.
 */
const BRANCH_VOICES: Record<string, string> = {
  german: 'de_DE-thorsten-medium',
  russian: 'ru_RU-irina-medium',
  sanskrit: 'ne_NP-google-medium',
  french: 'fr_FR-siwis-medium',
};

export function voiceForBranch(inspiredBy?: string): string {
  return BRANCH_VOICES[(inspiredBy ?? '').toLowerCase()] ?? DEFAULT_VOICE;
}

export interface VoiceOption {
  id: string;
  label: string;
}

/**
 * Curated subset for the manual-override dropdown. Restricted to voices compatible with
 * the fixed wasm phonemizer (see BRANCH_VOICES note); 130-symbol voices are excluded.
 */
export const CURATED_VOICES: VoiceOption[] = [
  { id: 'en_US-amy-low', label: 'English (US) — Amy' },
  { id: 'en_US-hfc_female-medium', label: 'English (US) — HFC female' },
  { id: 'en_US-ryan-medium', label: 'English (US) — Ryan' },
  { id: 'en_GB-alan-medium', label: 'English (UK) — Alan' },
  { id: 'en_GB-northern_english_male-medium', label: 'English (UK) — Northern male' },
  { id: 'de_DE-thorsten-medium', label: 'German — Thorsten' },
  { id: 'fr_FR-siwis-medium', label: 'French — Siwis' },
  { id: 'ru_RU-irina-medium', label: 'Russian — Irina' },
  { id: 'es_ES-davefx-medium', label: 'Spanish — Davefx' },
  { id: 'it_IT-paola-medium', label: 'Italian — Paola' },
  { id: 'ne_NP-google-medium', label: 'Nepali — Google' },
];

let selectedVoice: string = DEFAULT_VOICE;
let sessionPromise: Promise<TtsSession | null> | null = null;
let ready = false;
// Voices whose model rejected synthesis (e.g. symbol-table mismatch) are remembered so
// we transparently substitute the default voice instead of failing silently again.
const incompatible = new Set<string>();
let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;

export function isPiperReady(): boolean {
  return ready;
}

export function currentVoice(): string {
  return selectedVoice;
}

/**
 * Select (and start loading) a voice. Reuses the existing session if the voice is
 * unchanged; otherwise switches to the new voice, downloading its model if needed.
 */
export function setPiperVoice(
  voiceId: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<TtsSession | null> {
  if (incompatible.has(voiceId)) voiceId = DEFAULT_VOICE;
  if (voiceId === selectedVoice && sessionPromise) return sessionPromise;
  selectedVoice = voiceId;
  ready = false;
  const requested = voiceId;
  sessionPromise = (async () => {
    try {
      // The library keeps a static `_instance`; a second `create()` reuses it and only
      // relabels `voiceId` without reloading the model. Clear it so switching voices
      // actually loads the new model.
      (TtsSession as unknown as { _instance?: unknown })._instance = undefined;
      const session = await TtsSession.create({
        voiceId: voiceId as VoiceId,
        progress: (p) => onProgress?.(p.loaded, p.total),
        wasmPaths: WASM_PATHS,
      });
      if (selectedVoice === requested) ready = true;
      return session;
    } catch {
      if (selectedVoice === requested) sessionPromise = null;
      return null;
    }
  })();
  return sessionPromise;
}

async function play(wav: Blob): Promise<void> {
  if (currentAudio) currentAudio.pause();
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = URL.createObjectURL(wav);
  currentAudio = new Audio(currentUrl);
  await currentAudio.play();
}

export async function piperSpeak(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    const session = await (sessionPromise ?? setPiperVoice(selectedVoice));
    if (!session) return false;
    await play(await session.predict(text));
    return true;
  } catch (err) {
    // Synthesis failed for this voice (commonly an incompatible symbol table). Remember
    // it and retry once with the default English voice so playback still works.
    const failed = selectedVoice;
    console.warn(`[piper] synthesis failed for voice "${failed}"; falling back to ${DEFAULT_VOICE}.`, err);
    if (failed === DEFAULT_VOICE) return false;
    incompatible.add(failed);
    try {
      const fallback = await setPiperVoice(DEFAULT_VOICE);
      if (!fallback) return false;
      await play(await fallback.predict(text));
      return true;
    } catch {
      return false;
    }
  }
}
