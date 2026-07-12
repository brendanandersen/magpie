import type {
  LanguageDefinition,
  TranslationResult,
  ReverseResult,
  StyleOptions,
  LanguageOverrides,
  SoundChangeRule,
  SeedMatch,
} from '../../src/shared/types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

function styleQuery(style?: StyleOptions): string {
  if (!style) return '';
  const params = new URLSearchParams();
  if (style.branch) params.set('branch', style.branch);
  if (typeof style.harshness === 'number') params.set('harshness', String(style.harshness));
  if (typeof style.complexity === 'number') params.set('complexity', String(style.complexity));
  if (typeof style.generations === 'number') params.set('generations', String(style.generations));
  if (style.wordLength) params.set('wordLength', style.wordLength);
  const q = params.toString();
  return q ? `&${q}` : '';
}

export async function generateLanguage(seed: string, style?: StyleOptions): Promise<LanguageDefinition> {
  return json<LanguageDefinition>(
    await fetch(`/api/generate?seed=${encodeURIComponent(seed)}${styleQuery(style)}`),
  );
}

export async function generateWithOverrides(
  seed: string,
  style: StyleOptions | undefined,
  overrides: LanguageOverrides,
): Promise<LanguageDefinition> {
  return json<LanguageDefinition>(
    await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seed, style, overrides }),
    }),
  );
}

export async function fetchRulePool(): Promise<SoundChangeRule[]> {
  return json<SoundChangeRule[]>(await fetch('/api/rules'));
}

/** Fetch one fresh, plausible generation of sound-change rules for a seed. */
export async function generateGeneration(
  seed: string,
  generation: number,
  style?: StyleOptions,
): Promise<SoundChangeRule[]> {
  return json<SoundChangeRule[]>(
    await fetch(`/api/generation?seed=${encodeURIComponent(seed)}&generation=${generation}${styleQuery(style)}`),
  );
}

export async function translateSentence(
  seed: string,
  sentence: string,
  style?: StyleOptions,
  overrides?: LanguageOverrides,
): Promise<TranslationResult> {
  return json<TranslationResult>(
    await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seed, sentence, style, overrides }),
    }),
  );
}

export async function reverseSentence(
  seed: string,
  sentence: string,
  style?: StyleOptions,
  overrides?: LanguageOverrides,
): Promise<ReverseResult> {
  return json<ReverseResult>(
    await fetch('/api/reverse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seed, sentence, style, overrides }),
    }),
  );
}

export async function fetchMatchTargets(): Promise<{ name: string }[]> {
  return json<{ name: string }[]>(await fetch('/api/match/targets'));
}

export async function findSeeds(target: string, topK = 6): Promise<SeedMatch[]> {
  return json<SeedMatch[]>(
    await fetch(`/api/match?target=${encodeURIComponent(target)}&topK=${topK}`),
  );
}

export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 9);
}
