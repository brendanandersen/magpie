/**
 * Speech playback via the Piper neural voice. The model auto-downloads on page load
 * (see App); speech is a no-op until it is ready, and the UI disables speak controls
 * until then. There is no Web Speech fallback by design.
 */

import { isPiperReady, piperSpeak } from './piper';

/** Speak a generated word or phrase (romanized). No-op until the Piper voice is ready. */
export async function speak(text: string): Promise<void> {
  if (!text || !isPiperReady()) return;
  await piperSpeak(text);
}

/**
 * Sound out a single phoneme. Consonants are given a following vowel so they are
 * actually audible (a bare stop is silent otherwise).
 */
export async function speakPhoneme(roman: string, type: 'consonant' | 'vowel'): Promise<void> {
  await speak(type === 'consonant' ? `${roman}a` : roman);
}
