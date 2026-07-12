/**
 * Type-only re-exports shared between the backend and the React frontend. This
 * module has no runtime code, so the browser bundle never pulls in Node-only
 * generator internals (it only borrows the shapes).
 */

export type {
  LanguageDefinition,
  LanguageInventory,
  Phoneme,
  Phonotactics,
  GrammarParams,
  CaseDef,
  SoundChangeRule,
  DerivationStep,
  GeneratedWord,
  StyleOptions,
  Style,
  WordLength,
} from '../core/language.js';

export type { TranslationResult, TranslatedToken } from '../core/translator.js';

export type { ReverseResult, ReverseToken } from '../core/reverse.js';

export type { LanguageOverrides } from '../core/overrides.js';

export type { SeedMatch, MatchTarget, WordExample } from '../core/language-match.js';
