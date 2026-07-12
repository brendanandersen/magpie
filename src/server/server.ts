/**
 * Fastify backend for Magpie. Loads the Phase 1 data slice once into memory and
 * exposes generation/translation endpoints. The large ancestor index stays here on
 * the server; the browser only ever receives generated languages and translations.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadGeneratorData } from '../core/data-loader.js';
import { generateLanguage } from '../core/generator.js';
import { getRulePool, generateGenerationRules } from '../core/sound-change.js';
import { Rng } from '../core/rng.js';
import { resolveStyle } from '../core/language.js';
import { translate } from '../core/translator.js';
import { reverseTranslate } from '../core/reverse.js';
import { applyOverrides, hasOverrides, type LanguageOverrides } from '../core/overrides.js';
import { findClosestSeeds } from '../core/language-match.js';
import type { LanguageDefinition, StyleOptions, WordLength } from '../core/language.js';

const data = loadGeneratorData();

const app = Fastify({ logger: false });
await app.register(cors, { origin: true });

function parseStyle(src: Record<string, unknown>): StyleOptions {
  const num = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : Number(v));
  const wl = src.wordLength;
  return {
    branch: typeof src.branch === 'string' && src.branch ? src.branch : undefined,
    harshness: num(src.harshness),
    complexity: num(src.complexity),
    generations: num(src.generations),
    wordLength: wl === 'short' || wl === 'medium' || wl === 'long' ? (wl as WordLength) : undefined,
  };
}

function buildLanguage(
  seed: string,
  style: Record<string, unknown>,
  overrides?: LanguageOverrides,
): LanguageDefinition {
  const lang = generateLanguage(seed, data, parseStyle(style));
  return hasOverrides(overrides) ? applyOverrides(lang, overrides!) : lang;
}

app.get('/api/health', async () => ({ ok: true, headwords: Object.keys(data.ancestorIndex).length }));

app.get('/api/rules', async () => getRulePool());

// One fresh generation of sound-change rules, deterministic for seed+generation+style.
// Used by the customization UI when a user adds a new generation.
app.get('/api/generation', async (req) => {
  const query = (req.query ?? {}) as Record<string, unknown>;
  const seed = String(query.seed ?? 'magpie').trim() || 'magpie';
  const generation = Math.max(1, Math.round(Number(query.generation ?? 1)) || 1);
  const style = resolveStyle(parseStyle(query));
  return generateGenerationRules(new Rng(`${seed}::gen::${generation}`), style, generation);
});

app.get('/api/match/targets', async () => data.inventories.map((i) => ({ name: i.name })));

app.get('/api/match', async (req, reply) => {
  const query = (req.query ?? {}) as Record<string, unknown>;
  const name = String(query.target ?? '').trim();
  const target = data.inventories.find((i) => i.name === name);
  if (!target) {
    return reply.code(400).send({ error: `unknown target: ${name || '(none)'}` });
  }
  const num = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : Number(v));
  return findClosestSeeds(
    { name: target.name, consonants: target.consonants, vowels: target.vowels },
    data,
    {
      seedCount: num(query.seedCount),
      topK: num(query.topK),
      sweepStyle: query.sweep === '0' ? false : true,
    },
  );
});

app.get('/api/generate', async (req) => {
  const query = (req.query ?? {}) as Record<string, unknown>;
  const seed = String(query.seed ?? 'magpie').trim() || 'magpie';
  return generateLanguage(seed, data, parseStyle(query));
});

app.post('/api/generate', async (req) => {
  const body = (req.body ?? {}) as { seed?: string; style?: Record<string, unknown>; overrides?: LanguageOverrides };
  const seed = (body.seed ?? 'magpie').trim() || 'magpie';
  return buildLanguage(seed, body.style ?? {}, body.overrides);
});

interface TranslateBody {
  seed?: string;
  sentence?: string;
  style?: Record<string, unknown>;
  overrides?: LanguageOverrides;
}

app.post('/api/translate', async (req, reply) => {
  const body = (req.body ?? {}) as TranslateBody;
  const seed = (body.seed ?? 'magpie').trim() || 'magpie';
  const sentence = body.sentence ?? '';
  if (typeof sentence !== 'string') {
    return reply.code(400).send({ error: 'sentence must be a string' });
  }
  const lang = buildLanguage(seed, body.style ?? {}, body.overrides);
  return translate(sentence, lang, data.ancestorIndex);
});

app.post('/api/reverse', async (req, reply) => {
  const body = (req.body ?? {}) as TranslateBody;
  const seed = (body.seed ?? 'magpie').trim() || 'magpie';
  const sentence = body.sentence ?? '';
  if (typeof sentence !== 'string') {
    return reply.code(400).send({ error: 'sentence must be a string' });
  }
  const lang = buildLanguage(seed, body.style ?? {}, body.overrides);
  return reverseTranslate(sentence, lang);
});

const port = Number(process.env.PORT ?? 8787);
await app.listen({ port, host: '127.0.0.1' });
// eslint-disable-next-line no-console
console.log(`Magpie API listening on http://127.0.0.1:${port} (${Object.keys(data.ancestorIndex).length} headwords loaded)`);
