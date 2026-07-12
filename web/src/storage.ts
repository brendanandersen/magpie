import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';
import {
  normalizeSavedList,
  removeFromList,
  upsertEntry,
  type SavedLanguage,
} from '../../src/shared/saved';
import type { LanguageOverrides, StyleOptions } from '../../src/shared/types';

function hasOverrides(o?: LanguageOverrides): boolean {
  return !!o && (o.soundChangeRules !== undefined || o.consonants !== undefined || o.vowels !== undefined);
}

function bytesToB64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Compress overrides to a compact, URL-safe token (deflate + base64url). */
export function encodeOverrides(o: LanguageOverrides): string {
  return bytesToB64Url(deflateSync(strToU8(JSON.stringify(o)), { level: 9 }));
}

/**
 * Inverse of {@link encodeOverrides}. Also accepts a legacy raw-JSON token (old `?ov=` links)
 * so previously shared URLs keep working. Returns undefined for empty/invalid tokens.
 */
export function decodeOverrides(token: string): LanguageOverrides | undefined {
  const finish = (json: string) => {
    const parsed = JSON.parse(json) as LanguageOverrides;
    return hasOverrides(parsed) ? parsed : undefined;
  };
  try {
    return finish(strFromU8(inflateSync(b64UrlToBytes(token))));
  } catch {
    try {
      return finish(token); // legacy raw-JSON form
    } catch {
      return undefined;
    }
  }
}

const STORAGE_KEY = 'magpie.saved';

export function loadSaved(): SavedLanguage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeSavedList(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function persist(list: SavedLanguage[]): SavedLanguage[] {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore quota / unavailable storage
  }
  return list;
}

export function saveLanguage(
  seed: string,
  name: string,
  style?: StyleOptions,
  overrides?: LanguageOverrides,
): SavedLanguage[] {
  const entry: SavedLanguage = { seed, name, savedAt: Date.now() };
  if (style && Object.keys(style).length > 0) entry.style = style;
  if (hasOverrides(overrides)) entry.overrides = overrides;
  return persist(upsertEntry(loadSaved(), entry));
}

export function deleteLanguage(seed: string): SavedLanguage[] {
  return persist(removeFromList(loadSaved(), seed));
}

/** Read the seed from the URL (?seed=), if present. */
export function seedFromUrl(): string | null {
  const value = new URLSearchParams(window.location.search).get('seed');
  return value && value.trim() ? value.trim() : null;
}

/** Read manual overrides from the URL query (compressed `?oz=`, or legacy `?ov=<json>`). */
export function overridesFromUrl(): LanguageOverrides | undefined {
  const p = new URLSearchParams(window.location.search);
  const token = p.get('oz') ?? p.get('ov');
  return token ? decodeOverrides(token) : undefined;
}

/** Read style knobs from the URL query, if present. */
export function styleFromUrl(): StyleOptions {
  const p = new URLSearchParams(window.location.search);
  const style: StyleOptions = {};
  const branch = p.get('branch');
  if (branch) style.branch = branch;
  const h = p.get('harshness');
  if (h !== null && h !== '') style.harshness = Number(h);
  const c = p.get('complexity');
  if (c !== null && c !== '') style.complexity = Number(c);
  const g = p.get('generations');
  if (g !== null && g !== '') style.generations = Number(g);
  const wl = p.get('wordLength');
  if (wl === 'short' || wl === 'medium' || wl === 'long') style.wordLength = wl;
  return style;
}

function applyToUrl(url: URL, seed: string, style?: StyleOptions, overrides?: LanguageOverrides): void {
  url.searchParams.set('seed', seed);
  const set = (k: string, v: string | number | undefined) => {
    if (v === undefined || v === '') url.searchParams.delete(k);
    else url.searchParams.set(k, String(v));
  };
  set('branch', style?.branch);
  set('harshness', style?.harshness);
  set('complexity', style?.complexity);
  set('generations', style?.generations);
  set('wordLength', style?.wordLength);
  url.searchParams.delete('ov'); // drop the legacy uncompressed param
  if (hasOverrides(overrides)) url.searchParams.set('oz', encodeOverrides(overrides!));
  else url.searchParams.delete('oz');
}

/** Reflect the active seed + style + overrides in the URL without adding history entries. */
export function syncSeedToUrl(seed: string, style?: StyleOptions, overrides?: LanguageOverrides): void {
  const url = new URL(window.location.href);
  applyToUrl(url, seed, style, overrides);
  window.history.replaceState({}, '', url);
}

export function shareLink(seed: string, style?: StyleOptions, overrides?: LanguageOverrides): string {
  const url = new URL(window.location.href);
  applyToUrl(url, seed, style, overrides);
  return url.toString();
}

export function exportSaved(): void {
  const blob = new Blob([JSON.stringify(loadSaved(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'magpie-languages.json';
  a.click();
  URL.revokeObjectURL(url);
}

export async function importSaved(file: File): Promise<SavedLanguage[]> {
  const text = await file.text();
  const incoming = normalizeSavedList(JSON.parse(text));
  let list = loadSaved();
  for (const entry of [...incoming].reverse()) list = upsertEntry(list, entry);
  return persist(list);
}
